import { getCoverageGapsForMonth } from "./coverageService";
import { employeeFullName } from "./employeeIdentity";
import {
    getAdjustedWeeklyTargetMinutes,
    getDayOfWeek,
    getPaidShiftMinutes,
    getWeekStartDate,
} from "./hoursService";
import { activeEmployees } from "./teamService";
import { getOpenOperatingDays } from "./storeHoursService";
import { overlapsVacation } from "./vacationService";

import type {
    ConfigurablePlanningRuleId,
    Employee,
    PlannerState,
    PlanningRuleId,
    PlanningRuleMode,
    SchedulingRuleSettings,
    Shift,
    StoreHours,
    VacationPeriod,
} from "../types/planning";

export const ALL_PLANNING_RULES: readonly PlanningRuleId[] = [
    "opening-hours-coverage",
    "contracted-hours",
    "overlapping-shifts",
    "one-saturday-off-per-month",
    "employee-preferred-hours",
    "minimize-fragmentation",
];

export const REQUIRED_RULE_EXECUTION_ORDER: readonly ConfigurablePlanningRuleId[] = [
    "one-saturday-off-per-month",
    "opening-hours-coverage",
    "contracted-hours",
];

export const DEFAULT_SCHEDULING_RULE_SETTINGS: SchedulingRuleSettings = {
    minimumGeneratedShiftMinutes: 2 * 60,
    modes: {
        "contracted-hours": "prefer",
        "opening-hours-coverage": "prefer",
        "one-saturday-off-per-month": "prefer",
    },
    preferredOrder: [...ALL_PLANNING_RULES],
};

export const PLANNING_RULE_LABELS: Record<PlanningRuleId, string> = {
    "contracted-hours": "Schedule contracted hours",
    "opening-hours-coverage": "Maximize opening-hours coverage",
    "overlapping-shifts": "Provide overlapping shifts",
    "employee-preferred-hours": "Prefer employee hours",
    "one-saturday-off-per-month": "One Saturday off per month",
    "minimize-fragmentation": "Prefer longer, consolidated shifts",
};

export interface ApplicableSaturday {
    date: string;
}

export interface PlanningRuleGuidance {
    rule: PlanningRuleId;
    level: "required" | "preferred";
    message: string;
    employeeId?: string;
    date?: string;
}

export function isValidSchedulingRuleSettings(
    value: unknown,
): value is SchedulingRuleSettings {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const settings = value as SchedulingRuleSettings;
    if (!Number.isInteger(settings.minimumGeneratedShiftMinutes) ||
        settings.minimumGeneratedShiftMinutes < 30 ||
        settings.minimumGeneratedShiftMinutes > 8 * 60 ||
        settings.minimumGeneratedShiftMinutes % 30 !== 0) return false;
    if (!settings.modes || typeof settings.modes !== "object") return false;
    const configurable: ConfigurablePlanningRuleId[] = [
        "contracted-hours", "opening-hours-coverage", "one-saturday-off-per-month",
    ];
    if (!configurable.every((rule) =>
        settings.modes[rule] === "prefer" || settings.modes[rule] === "require")) return false;
    return Array.isArray(settings.preferredOrder) &&
        settings.preferredOrder.length === ALL_PLANNING_RULES.length &&
        new Set(settings.preferredOrder).size === ALL_PLANNING_RULES.length &&
        settings.preferredOrder.every((rule) => ALL_PLANNING_RULES.includes(rule));
}

export function cloneSchedulingRuleSettings(
    settings: SchedulingRuleSettings,
): SchedulingRuleSettings {
    return structuredClone(settings);
}

export function preferredRules(settings: SchedulingRuleSettings): PlanningRuleId[] {
    return settings.preferredOrder.filter((rule) =>
        !isConfigurableRule(rule) || settings.modes[rule] === "prefer");
}

export function ruleMode(
    settings: SchedulingRuleSettings,
    rule: ConfigurablePlanningRuleId,
): PlanningRuleMode {
    return settings.modes[rule];
}

export function getApplicableSaturdays(
    employee: Employee,
    absences: VacationPeriod[],
    storeHours: StoreHours,
    year: number,
    month: number,
): ApplicableSaturday[] {
    const openDays = new Set(getOpenOperatingDays(storeHours));
    if (!openDays.has(6) || !employee.availability.days.includes(6)) return [];
    const hasNormallyWorkableWeekday = employee.availability.days.some((day) =>
        day >= 1 && day <= 5 && openDays.has(day as 1 | 2 | 3 | 4 | 5));
    if (!hasNormallyWorkableWeekday) return [];

    const result: ApplicableSaturday[] = [];
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= days; day += 1) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (getDayOfWeek(date) !== 6 || overlapsVacation(absences, employee.id, date, date)) continue;
        result.push({ date });
    }
    return result;
}

export function saturdayIsUnscheduled(
    saturday: ApplicableSaturday,
    employeeId: string,
    shifts: readonly Shift[],
): boolean {
    return !shifts.some((shift) => shift.employeeId === employeeId && shift.date === saturday.date);
}

export function evaluatePlanningRules(state: PlannerState): PlanningRuleGuidance[] {
    return [
        ...evaluateCoverage(state),
        ...evaluateContractedHours(state),
        ...evaluateSaturdayOff(state),
    ];
}

function evaluateCoverage(state: PlannerState): PlanningRuleGuidance[] {
    const level = state.schedulingRules.modes["opening-hours-coverage"] === "require"
        ? "required" as const : "preferred" as const;
    return getCoverageGapsForMonth(state).map((gap) => ({
        rule: "opening-hours-coverage" as const,
        level,
        date: gap.date,
        message: level === "required"
            ? `Required opening-hours coverage remains unfilled ${gap.start}–${gap.end}. PP_Crew could not fully satisfy this requirement within the generated plan and configured scheduling boundaries.`
            : `Opening-hours coverage remains unfilled ${gap.start}–${gap.end}.`,
    }));
}

function evaluateContractedHours(state: PlannerState): PlanningRuleGuidance[] {
    const level = state.schedulingRules.modes["contracted-hours"] === "require"
        ? "required" as const : "preferred" as const;
    const prefix = `${state.selectedYear}-${String(state.selectedMonth).padStart(2, "0")}-`;
    const weekStarts = new Set(state.shifts.filter((shift) => shift.date.startsWith(prefix))
        .map((shift) => getWeekStartDate(shift.date)));
    // Include planning weeks even when generation produced no shifts.
    for (let day = 1; day <= new Date(Date.UTC(state.selectedYear, state.selectedMonth, 0)).getUTCDate(); day += 1) {
        weekStarts.add(getWeekStartDate(
            `${state.selectedYear}-${String(state.selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        ));
    }

    return activeEmployees(state.employees).flatMap((employee) =>
        [...weekStarts].sort().flatMap((weekStart) => {
            const weekEnd = addDays(weekStart, 6);
            const target = getAdjustedWeeklyTargetMinutes(
                employee, state.vacations, weekStart, weekEnd,
            );
            const paid = state.shifts.filter((shift) =>
                shift.employeeId === employee.id && getWeekStartDate(shift.date) === weekStart)
                .reduce((total, shift) => total + getPaidShiftMinutes(shift), 0);
            if (paid >= target) return [];
            const deficit = target - paid;
            return [{
                rule: "contracted-hours" as const,
                level,
                employeeId: employee.id,
                message: level === "required"
                    ? `${employeeFullName(employee)} remains ${formatMinutes(deficit)} below their vacation-adjusted weekly target for ${weekStart}–${weekEnd}. PP_Crew could not fully satisfy this requirement within the generated plan and configured scheduling boundaries.`
                    : `${employeeFullName(employee)} is ${formatMinutes(deficit)} below their vacation-adjusted weekly target for ${weekStart}–${weekEnd}.`,
            }];
        }));
}

function evaluateSaturdayOff(state: PlannerState): PlanningRuleGuidance[] {
    const level = state.schedulingRules.modes["one-saturday-off-per-month"] === "require"
        ? "required" as const : "preferred" as const;
    const absences = [...state.vacations, ...state.sicknesses];
    return activeEmployees(state.employees).flatMap((employee) => {
        const saturdays = getApplicableSaturdays(
            employee, absences, state.storeHours, state.selectedYear, state.selectedMonth,
        );
        if (saturdays.length === 0 || saturdays.some((saturday) =>
            saturdayIsUnscheduled(saturday, employee.id, state.shifts))) return [];
        return [{
            rule: "one-saturday-off-per-month" as const,
            level,
            employeeId: employee.id,
            message: level === "required"
                ? `${employeeFullName(employee)} did not receive a normally workable Saturday off. PP_Crew could not fully satisfy this requirement within the generated plan and configured scheduling boundaries.`
                : `${employeeFullName(employee)} did not receive a normally workable Saturday off this month.`,
        }];
    });
}

function isConfigurableRule(rule: PlanningRuleId): rule is ConfigurablePlanningRuleId {
    return rule === "contracted-hours" || rule === "opening-hours-coverage" ||
        rule === "one-saturday-off-per-month";
}

function addDays(date: string, amount: number): string {
    const [year, month, day] = date.split("-").map(Number);
    const value = new Date(Date.UTC(year, month - 1, day + amount));
    return value.toISOString().slice(0, 10);
}

function formatMinutes(value: number): string {
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
