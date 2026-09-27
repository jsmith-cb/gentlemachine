import { activeEmployees } from "./teamService";
import { employeeFullName } from "./employeeIdentity";
import { getDayOfWeek } from "./hoursService";
import { getOperatingDay } from "./storeHoursService";
import { overlapsVacation } from "./vacationService";

import type {
    Employee,
    PlannerState,
    Shift,
    SoftRuleSettings,
    StoreHours,
    VacationPeriod,
} from "../types/planning";

export const DEFAULT_SOFT_RULE_SETTINGS: SoftRuleSettings = {
    oneWeekendOffPerMonth: false,
};

export interface ApplicableWeekend {
    key: string;
    dates: string[];
}

export interface SoftRuleGuidance {
    rule: "oneWeekendOffPerMonth";
    employeeId: string;
    message: string;
}

export function isValidSoftRuleSettings(value: unknown): value is SoftRuleSettings {
    return typeof value === "object" && value !== null && !Array.isArray(value) &&
        typeof (value as SoftRuleSettings).oneWeekendOffPerMonth === "boolean";
}

export function cloneSoftRuleSettings(settings: SoftRuleSettings): SoftRuleSettings {
    return { ...settings };
}

function dateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(value: string, amount: number): string {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + amount));
    return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function getApplicableWeekends(
    employee: Employee,
    vacations: VacationPeriod[],
    storeHours: StoreHours,
    year: number,
    month: number,
): ApplicableWeekend[] {
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const weekends = new Map<string, string[]>();

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = dateKey(year, month, day);
        const dayOfWeek = getDayOfWeek(date);
        if (dayOfWeek !== 0 && dayOfWeek !== 6) continue;
        if (!getOperatingDay(storeHours, dayOfWeek)?.isOpen ||
            !employee.availability.days.includes(dayOfWeek)) continue;
        const saturday = dayOfWeek === 6 ? date : addDays(date, -1);
        const applicable = weekends.get(saturday) ?? [];
        applicable.push(date);
        weekends.set(saturday, applicable);
    }

    return [...weekends.entries()].flatMap(([key, dates]) => {
        const inMonthDates = dates.filter((date) => date.startsWith(monthPrefix));
        if (inMonthDates.length === 0 || inMonthDates.some((date) =>
            overlapsVacation(vacations, employee.id, date, date),
        )) return [];
        return [{ key, dates: inMonthDates }];
    });
}

export function weekendIsUnscheduled(
    weekend: ApplicableWeekend,
    employeeId: string,
    shifts: readonly Shift[],
): boolean {
    return !shifts.some((shift) =>
        shift.employeeId === employeeId && weekend.dates.includes(shift.date),
    );
}

export function evaluateSoftRules(state: PlannerState): SoftRuleGuidance[] {
    if (!state.softRules.oneWeekendOffPerMonth) return [];

    return activeEmployees(state.employees).flatMap((employee) => {
        const weekends = getApplicableWeekends(
            employee, state.vacations, state.storeHours,
            state.selectedYear, state.selectedMonth,
        );
        if (weekends.length === 0 || weekends.some((weekend) =>
            weekendIsUnscheduled(weekend, employee.id, state.shifts),
        )) return [];
        return [{
            rule: "oneWeekendOffPerMonth" as const,
            employeeId: employee.id,
            message: `${employeeFullName(employee)} does not have a normally workable weekend off this month.`,
        }];
    });
}
