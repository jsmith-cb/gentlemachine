import {
    createDateKey,
    getAdjustedWeeklyTargetMinutes,
    getDayOfWeek,
    getShiftDurationMinutes,
    getWeekStartsForMonth,
    getWeekStartDate,
    minutesToTime,
    timeToMinutes,
} from "./hoursService";
import { getCoverageGapsForDate } from "./coverageService";
import { overlapsVacation } from "./vacationService";
import { activeEmployees } from "./teamService";
import {
    getOpenOperatingDays,
    getOperatingDay,
    getOperatingHoursForDate,
} from "./storeHoursService";
import {
    DEFAULT_SCHEDULING_RULE_SETTINGS,
    getApplicableSaturdays,
    preferredRules,
    REQUIRED_RULE_EXECUTION_ORDER,
} from "./schedulingRulesService";
import {
    exceedsMaximumStandardShift,
    getEmployeeScheduledMinutesForDate,
    getEffectiveMaximumScheduledMinutesPerDay,
    MAXIMUM_STANDARD_SHIFT_MINUTES,
    remainingEmployeeScheduledMinutesForDate,
} from "./shiftRules";

import type {
    Employee,
    PlannerState,
    Shift,
    StoreHours,
    SchedulingRuleSettings,
    PlanningRuleId,
    SicknessPeriod,
    VacationPeriod,
} from "../types/planning";

export interface GenerationResult {
    shifts: Shift[];
}

export type GenerationFlexibility = "hour-constrained" | "day-constrained" | "general";

const GENERATION_SLOT_MINUTES = 30;

function maxTime(a: string, b: string): string {
    return timeToMinutes(a) >= timeToMinutes(b) ? a : b;
}

function minTime(a: string, b: string): string {
    return timeToMinutes(a) <= timeToMinutes(b) ? a : b;
}

function legalWindow(
    employee: Employee,
    storeHours: StoreHours,
    date: string,
): { start: string; end: string } | null {
    const operating = getOperatingHoursForDate(storeHours, date);
    if (!operating) return null;
    const { earliestStart, latestEnd } = employee.availability;
    return {
        start: earliestStart ? maxTime(earliestStart, operating.open) : operating.open,
        end: latestEnd ? minTime(latestEnd, operating.close) : operating.close,
    };
}

function preferredWindow(
    employee: Employee,
    day: number,
    legal: { start: string; end: string },
): { start: string; end: string } | null {
    const preferred = employee.availability.dayHours?.[day];
    if (!preferred?.earliestStart && !preferred?.latestEnd) return null;
    const start = preferred.earliestStart
        ? maxTime(preferred.earliestStart, legal.start)
        : legal.start;
    const end = preferred.latestEnd
        ? minTime(preferred.latestEnd, legal.end)
        : legal.end;
    return timeToMinutes(start) < timeToMinutes(end) ? { start, end } : null;
}

export function classifyGenerationFlexibility(
    employee: Employee,
    storeHours: StoreHours,
): GenerationFlexibility {
    const hourConstrained = getOpenOperatingDays(storeHours).some((dayOfWeek) => {
        const operatingDay = getOperatingDay(storeHours, dayOfWeek);
        if (!operatingDay?.isOpen) return false;
        const start = employee.availability.earliestStart
            ? maxTime(employee.availability.earliestStart, operatingDay.openTime)
            : operatingDay.openTime;
        const end = employee.availability.latestEnd
            ? minTime(employee.availability.latestEnd, operatingDay.closeTime)
            : operatingDay.closeTime;
        return start !== operatingDay.openTime || end !== operatingDay.closeTime;
    });
    if (hourConstrained) return "hour-constrained";

    const availableDays = new Set(employee.availability.days);
    if (getOpenOperatingDays(storeHours).some((day) => !availableDays.has(day))) return "day-constrained";
    return "general";
}

const FLEXIBILITY_RANK: Record<GenerationFlexibility, number> = {
    "hour-constrained": 0,
    "day-constrained": 1,
    general: 2,
};

export function orderEmployeesForGeneration(
    employees: Employee[],
    storeHours: StoreHours,
): Employee[] {
    return [...employees].sort((a, b) => {
        const rank = FLEXIBILITY_RANK[classifyGenerationFlexibility(a, storeHours)] -
            FLEXIBILITY_RANK[classifyGenerationFlexibility(b, storeHours)];
        return rank || a.id.localeCompare(b.id);
    });
}

let shiftIdCounter = 0;

export function resetShiftIdCounter(): void {
    shiftIdCounter = 0;
}

function nextShiftId(year: number, month: number): string {
    shiftIdCounter += 1;
    return `generated-shift-${year}-${String(month).padStart(2, "0")}-${shiftIdCounter}`;
}

function addDays(date: string, amount: number): string {
    const [year, month, day] = date.split("-").map(Number);
    const value = new Date(Date.UTC(year, month - 1, day + amount));
    return createDateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function roundUpToSlot(minutes: number): number {
    return Math.ceil(minutes / GENERATION_SLOT_MINUTES) * GENERATION_SLOT_MINUTES;
}

function roundDownToSlot(minutes: number): number {
    return Math.floor(minutes / GENERATION_SLOT_MINUTES) * GENERATION_SLOT_MINUTES;
}

function datesInPlanningWeek(
    weekStart: string,
    year: number,
    month: number,
    openDays: readonly number[],
): string[] {
    return [...openDays]
        .sort((left, right) => ((left + 6) % 7) - ((right + 6) % 7))
        .map((day) => addDays(weekStart, (day + 6) % 7))
        .filter((date) => date.startsWith(`${year}-${String(month).padStart(2, "0")}-`));
}

function generatedForEmployeeInWeek(
    generated: Shift[],
    employeeId: string,
    weekStart: string,
): Shift[] {
    return generated.filter(
        (shift) => shift.employeeId === employeeId && getWeekStartDate(shift.date) === weekStart,
    );
}

function usableDatesRemaining(
    employee: Employee,
    vacations: VacationPeriod[],
    dates: string[],
    fromDate: string,
    daysAlreadyWorked: number,
): number {
    const availableDates = dates.filter((date) =>
        date >= fromDate &&
        employee.availability.days.includes(getDayOfWeek(date)) &&
        !overlapsVacation(vacations, employee.id, date, date),
    ).length;
    return Math.min(availableDates, Math.max(0, employee.maxDaysPerWeek - daysAlreadyWorked));
}

function overlapMinutes(
    start: number,
    end: number,
    gaps: Array<{ start: string; end: string }>,
): number {
    return gaps.reduce((total, gap) => total + Math.max(
        0,
        Math.min(end, timeToMinutes(gap.end)) - Math.max(start, timeToMinutes(gap.start)),
    ), 0);
}

function intervalOverlapMinutes(
    start: number,
    end: number,
    interval: { start: string; end: string } | null,
): number {
    if (!interval) return 0;
    return Math.max(
        0,
        Math.min(end, timeToMinutes(interval.end)) - Math.max(start, timeToMinutes(interval.start)),
    );
}

interface ShiftCandidate {
    employee: Employee;
    shift: Shift;
    coverageMinutes: number;
    remainingRatio: number;
    legalStart: number;
    legalEnd: number;
    softRuleProtected?: boolean;
    scores: Record<PlanningRuleId, number>;
}

function protectedSaturdayDates(
    employees: Employee[],
    vacations: VacationPeriod[],
    storeHours: StoreHours,
    year: number,
    month: number,
): Map<string, Set<string>> {
    const protectedDates = new Map<string, Set<string>>();
    [...employees].sort((left, right) => left.id.localeCompare(right.id))
        .forEach((employee, index) => {
            const saturdays = getApplicableSaturdays(
                employee, vacations, storeHours, year, month,
            );
            const selected = saturdays[index % Math.max(saturdays.length, 1)];
            if (selected) protectedDates.set(employee.id, new Set([selected.date]));
        });
    return protectedDates;
}

function bestShiftForEmployee(
    employee: Employee,
    date: string,
    storeHours: StoreHours,
    gaps: Array<{ start: string; end: string }>,
    remainingWeeklyMinutes: number,
    remainingUsableDates: number,
    minimumGeneratedShiftMinutes: number,
    ruleOrder: readonly PlanningRuleId[],
    allShifts: readonly Shift[],
    protectedSaturday: boolean,
): ShiftCandidate | null {
    if (remainingUsableDates === 0 ||
        remainingWeeklyMinutes < minimumGeneratedShiftMinutes) return null;

    const window = legalWindow(employee, storeHours, date);
    if (!window) return null;
    const windowStart = roundUpToSlot(timeToMinutes(window.start));
    const windowEnd = roundDownToSlot(timeToMinutes(window.end));
    if (windowEnd - windowStart < minimumGeneratedShiftMinutes) return null;

    const plannedSlots = Math.min(
        remainingUsableDates,
        Math.floor(remainingWeeklyMinutes / minimumGeneratedShiftMinutes),
    );
    if (plannedSlots === 0) return null;

    const dailyScheduledBudget = Math.min(
        remainingWeeklyMinutes,
        Math.ceil(remainingWeeklyMinutes / plannedSlots / GENERATION_SLOT_MINUTES) *
            GENERATION_SLOT_MINUTES,
    );
    let best: ShiftCandidate | null = null;
    const preferred = preferredWindow(employee, getDayOfWeek(date), window);
    const operating = getOperatingHoursForDate(storeHours, date)!;
    const placeLater = timeToMinutes(gaps[0]?.start ?? operating.open) >
        timeToMinutes(operating.open);

    for (let start = windowStart; start < windowEnd; start += GENERATION_SLOT_MINUTES) {
        for (
            let end = start + minimumGeneratedShiftMinutes;
            end <= Math.min(windowEnd, start + MAXIMUM_STANDARD_SHIFT_MINUTES);
            end += GENERATION_SLOT_MINUTES
        ) {
            const candidate: Shift = {
                id: "candidate",
                employeeId: employee.id,
                date,
                start: minutesToTime(start),
                end: minutesToTime(end),
            };
            const scheduled = getShiftDurationMinutes(candidate);
            if (scheduled > dailyScheduledBudget || scheduled > remainingWeeklyMinutes) continue;
            const coverage = overlapMinutes(start, end, gaps);
            const preferredMinutes = intervalOverlapMinutes(start, end, preferred);
            if (coverage === 0) continue;
            const overlap = overlapWithScheduledMinutes(candidate, allShifts);
            const proposed: ShiftCandidate = {
                employee,
                shift: candidate,
                coverageMinutes: coverage,
                remainingRatio: remainingWeeklyMinutes / Math.max(employee.weeklyTargetMinutes, 1),
                legalStart: windowStart,
                legalEnd: windowEnd,
                softRuleProtected: protectedSaturday,
                scores: {
                    "contracted-hours": scheduled,
                    "opening-hours-coverage": coverage,
                    "overlapping-shifts": overlap,
                    "employee-preferred-hours": preferredMinutes,
                    "one-saturday-off-per-month": protectedSaturday ? -1 : 0,
                    "minimize-fragmentation": scheduled,
                },
            };
            if (!best || compareCandidateScores(proposed, best, ruleOrder) < 0 ||
                (compareCandidateScores(proposed, best, ruleOrder) === 0 && (placeLater
                    ? start > timeToMinutes(best.shift.start)
                    : start < timeToMinutes(best.shift.start)))) best = proposed;
        }
    }
    return best;
}

function overlapWithScheduledMinutes(candidate: Shift, shifts: readonly Shift[]): number {
    const start = timeToMinutes(candidate.start);
    const end = timeToMinutes(candidate.end);
    return shifts.filter((shift) => shift.date === candidate.date && shift.employeeId !== candidate.employeeId)
        .reduce((total, shift) => total + Math.max(0,
            Math.min(end, timeToMinutes(shift.end)) - Math.max(start, timeToMinutes(shift.start))), 0);
}

function compareCandidateScores(
    left: ShiftCandidate,
    right: ShiftCandidate,
    ruleOrder: readonly PlanningRuleId[],
): number {
    for (const rule of ruleOrder) {
        const difference = right.scores[rule] - left.scores[rule];
        if (difference !== 0) return difference;
    }
    return 0;
}

function rulePrecedes(
    ruleOrder: readonly PlanningRuleId[],
    left: PlanningRuleId,
    right: PlanningRuleId,
): boolean {
    const leftIndex = ruleOrder.indexOf(left);
    const rightIndex = ruleOrder.indexOf(right);
    return leftIndex >= 0 && rightIndex >= 0 && leftIndex < rightIndex;
}

function extendShiftForSmallCoverageGap(
    active: Employee[],
    vacations: VacationPeriod[],
    storeHours: StoreHours,
    generated: Shift[],
    existingShifts: readonly Shift[],
    date: string,
    weekStart: string,
    weeklyTargets: Map<string, number>,
    gaps: Array<{ start: string; end: string }>,
    settings: SchedulingRuleSettings,
): boolean {
    for (const gap of gaps) {
        const gapStart = timeToMinutes(gap.start);
        const gapEnd = timeToMinutes(gap.end);
        if (gapEnd - gapStart >= settings.minimumGeneratedShiftMinutes) continue;

        const candidates = generated.flatMap((shift, index) => {
            if (shift.date !== date ||
                (timeToMinutes(shift.end) !== gapStart && timeToMinutes(shift.start) !== gapEnd)) {
                return [];
            }
            const employee = active.find(({ id }) => id === shift.employeeId);
            if (!employee || overlapsVacation(vacations, employee.id, date, date)) return [];
            const legal = legalWindow(employee, storeHours, date);
            if (!legal) return [];
            const extended: Shift = timeToMinutes(shift.end) === gapStart
                ? { ...shift, end: gap.end }
                : { ...shift, start: gap.start };
            if (timeToMinutes(extended.start) < timeToMinutes(legal.start) ||
                timeToMinutes(extended.end) > timeToMinutes(legal.end) ||
                exceedsMaximumStandardShift(extended)) return [];

            const employeeWeek = generatedForEmployeeInWeek(
                [...existingShifts, ...generated], employee.id, weekStart,
            );
            const scheduled = employeeWeek.reduce(
                (total, candidate) => total + getShiftDurationMinutes(candidate), 0,
            );
            const proposed = scheduled - getShiftDurationMinutes(shift) + getShiftDurationMinutes(extended);
            const target = weeklyTargets.get(employee.id) ?? 0;
            const proposedDay = getEmployeeScheduledMinutesForDate(
                [...existingShifts, ...generated], employee.id, date,
            ) - getShiftDurationMinutes(shift) + getShiftDurationMinutes(extended);
            // Generated schedules may leave coverage unresolved, but they must
            // not create overtime above the vacation-adjusted weekly target.
            if (proposed > target ||
                proposedDay > getEffectiveMaximumScheduledMinutesPerDay(employee)) return [];

            return [{
                index,
                extended,
                overage: Math.max(0, proposed - target),
                flexibility: FLEXIBILITY_RANK[classifyGenerationFlexibility(employee, storeHours)],
                employeeId: employee.id,
            }];
        }).sort((left, right) =>
            left.overage - right.overage ||
            left.flexibility - right.flexibility ||
            left.employeeId.localeCompare(right.employeeId),
        );

        const selected = candidates[0];
        if (selected) {
            generated[selected.index] = selected.extended;
            return true;
        }
    }
    return false;
}

function compareCoverageCandidates(
    left: ShiftCandidate,
    right: ShiftCandidate,
    gaps: Array<{ start: string; end: string }>,
    storeHours: StoreHours,
    ruleOrder: readonly PlanningRuleId[],
): number {
    const ruleComparison = compareCandidateScores(left, right, ruleOrder);
    if (ruleComparison !== 0) return ruleComparison;
    const operating = getOperatingHoursForDate(storeHours, left.shift.date);
    if (!operating) return 0;
    const focus = timeToMinutes(gaps[0]?.start ?? operating.open);
    const leftReachesFocus = left.legalStart <= focus;
    const rightReachesFocus = right.legalStart <= focus;
    if (leftReachesFocus !== rightReachesFocus) return leftReachesFocus ? -1 : 1;

    if (focus === timeToMinutes(operating.open)) {
        const earlierEnd = left.legalEnd - right.legalEnd;
        if (earlierEnd !== 0) return earlierEnd;
    } else {
        const laterStart = right.legalStart - left.legalStart;
        if (laterStart !== 0) return laterStart;
    }

    const flexibility = FLEXIBILITY_RANK[
        classifyGenerationFlexibility(left.employee, storeHours)
    ] - FLEXIBILITY_RANK[
        classifyGenerationFlexibility(right.employee, storeHours)
    ];
    return flexibility ||
        right.remainingRatio - left.remainingRatio ||
        right.coverageMinutes - left.coverageMinutes ||
        left.employee.id.localeCompare(right.employee.id);
}

function coverageGaps(
    employees: Employee[],
    vacations: VacationPeriod[],
    storeHours: StoreHours,
    shifts: Shift[],
    date: string,
    year: number,
    month: number,
): Array<{ start: string; end: string }> {
    const state: PlannerState = {
        selectedYear: year,
        selectedMonth: month,
        storeHours,
        schedulingRules: DEFAULT_SCHEDULING_RULE_SETTINGS,
        employees,
        shifts,
        vacations,
        sicknesses: [],
    };
    return getCoverageGapsForDate(state, date);
}

export function findContractExtensionCandidate(
    employee: Employee,
    storeHours: StoreHours,
    shift: Shift,
    remainingTargetMinutes: number,
): Shift | null {
    if (remainingTargetMinutes <= 0) return null;

    const legal = legalWindow(employee, storeHours, shift.date);
    if (!legal) return null;
    const legalStart = roundUpToSlot(timeToMinutes(legal.start));
    const legalEnd = roundDownToSlot(timeToMinutes(legal.end));
    const originalScheduled = getShiftDurationMinutes(shift);
    const preferred = preferredWindow(employee, getDayOfWeek(shift.date), legal);
    let best: { shift: Shift; addedScheduled: number; preferred: number } | null = null;

    for (
        let start = timeToMinutes(shift.start);
        start >= legalStart;
        start -= GENERATION_SLOT_MINUTES
    ) {
        for (
            let end = timeToMinutes(shift.end);
            end <= legalEnd;
            end += GENERATION_SLOT_MINUTES
        ) {
            const candidate: Shift = {
                ...shift,
                start: minutesToTime(start),
                end: minutesToTime(end),
            };
            if (exceedsMaximumStandardShift(candidate)) continue;
            const addedScheduled = getShiftDurationMinutes(candidate) - originalScheduled;
            if (addedScheduled <= 0 || addedScheduled > remainingTargetMinutes) continue;
            const preferredMinutes = intervalOverlapMinutes(start, end, preferred);
            if (!best || addedScheduled > best.addedScheduled ||
                (addedScheduled === best.addedScheduled && preferredMinutes > best.preferred) ||
                (addedScheduled === best.addedScheduled && preferredMinutes === best.preferred &&
                    start < timeToMinutes(best.shift.start))) {
                best = { shift: candidate, addedScheduled, preferred: preferredMinutes };
            }
        }
    }

    return best?.shift ?? null;
}

function extendGeneratedShiftTowardTarget(
    employee: Employee,
    storeHours: StoreHours,
    generated: Shift[],
    existingShifts: readonly Shift[],
    weekStart: string,
    remainingTargetMinutes: number,
): boolean {
    if (remainingTargetMinutes <= 0) return false;

    let best: { index: number; shift: Shift; addedScheduled: number; preferred: number } | null = null;
    for (let index = 0; index < generated.length; index += 1) {
        const shift = generated[index];
        if (!shift) continue;
        if (shift.employeeId !== employee.id || getWeekStartDate(shift.date) !== weekStart) continue;
        const originalScheduled = getShiftDurationMinutes(shift);
        const legal = legalWindow(employee, storeHours, shift.date);
        if (!legal) continue;
        const preferred = preferredWindow(employee, getDayOfWeek(shift.date), legal);
        const candidate = findContractExtensionCandidate(
            employee, storeHours, shift, Math.min(
                remainingTargetMinutes,
                remainingEmployeeScheduledMinutesForDate(
                    employee, [...existingShifts, ...generated], shift.date,
                ),
            ),
        );
        if (!candidate) continue;
        const addedScheduled = getShiftDurationMinutes(candidate) - originalScheduled;
        const preferredMinutes = intervalOverlapMinutes(
            timeToMinutes(candidate.start), timeToMinutes(candidate.end), preferred,
        );
        if (!best || addedScheduled > best.addedScheduled ||
            (addedScheduled === best.addedScheduled && preferredMinutes > best.preferred) ||
            (addedScheduled === best.addedScheduled && preferredMinutes === best.preferred &&
                timeToMinutes(candidate.start) < timeToMinutes(best.shift.start))) {
            best = { index, shift: candidate, addedScheduled, preferred: preferredMinutes };
        }
    }

    if (!best) return false;
    generated[best.index] = best.shift;
    return true;
}

function fulfillWeeklyTargets(
    active: Employee[],
    vacations: VacationPeriod[],
    storeHours: StoreHours,
    generated: Shift[],
    existingShifts: readonly Shift[],
    dates: string[],
    weekStart: string,
    weeklyTargets: Map<string, number>,
    protectedDates: Map<string, Set<string>>,
    settings: SchedulingRuleSettings,
    ruleOrder: readonly PlanningRuleId[],
): void {
    const saturdayMode = settings.modes["one-saturday-off-per-month"];
    const protectPreferredSaturday = saturdayMode === "require" ||
        rulePrecedes(ruleOrder, "one-saturday-off-per-month", "contracted-hours");
    const ordered = [...active].sort((left, right) => {
        const flexibility = FLEXIBILITY_RANK[classifyGenerationFlexibility(left, storeHours)] -
            FLEXIBILITY_RANK[classifyGenerationFlexibility(right, storeHours)];
        const allShifts = [...existingShifts, ...generated];
        const leftScheduled = generatedForEmployeeInWeek(allShifts, left.id, weekStart)
            .reduce((total, shift) => total + getShiftDurationMinutes(shift), 0);
        const rightScheduled = generatedForEmployeeInWeek(allShifts, right.id, weekStart)
            .reduce((total, shift) => total + getShiftDurationMinutes(shift), 0);
        const leftDeficit = (weeklyTargets.get(left.id) ?? 0) - leftScheduled;
        const rightDeficit = (weeklyTargets.get(right.id) ?? 0) - rightScheduled;
        return flexibility || rightDeficit - leftDeficit || left.id.localeCompare(right.id);
    });

    for (const employee of ordered) {
        while (true) {
            const allShifts = [...existingShifts, ...generated];
            const employeeWeek = generatedForEmployeeInWeek(allShifts, employee.id, weekStart);
            const scheduled = employeeWeek.reduce(
                (total, shift) => total + getShiftDurationMinutes(shift), 0,
            );
            const remaining = (weeklyTargets.get(employee.id) ?? 0) - scheduled;
            if (remaining <= 0) break;

            if (extendGeneratedShiftTowardTarget(
                employee, storeHours, generated, existingShifts, weekStart, remaining,
            )) continue;

            if (remaining < settings.minimumGeneratedShiftMinutes) break;

            const daysWorked = new Set(employeeWeek.map((shift) => shift.date)).size;
            if (daysWorked >= employee.maxDaysPerWeek) break;
            const availableDates = dates.filter((date) =>
                employee.availability.days.includes(getDayOfWeek(date)) &&
                !overlapsVacation(vacations, employee.id, date, date) &&
                !(protectPreferredSaturday && protectedDates.get(employee.id)?.has(date)) &&
                !allShifts.some((shift) => shift.employeeId === employee.id && shift.date === date),
            );
            const date = availableDates[0];
            if (!date) break;
            const operating = getOperatingHoursForDate(storeHours, date);
            if (!operating) break;
            const candidate = bestShiftForEmployee(
                employee,
                date,
                storeHours,
                [{ start: operating.open, end: operating.close }],
                Math.min(
                    remaining,
                    remainingEmployeeScheduledMinutesForDate(employee, allShifts, date),
                ),
                Math.min(availableDates.length, employee.maxDaysPerWeek - daysWorked),
                settings.minimumGeneratedShiftMinutes,
                ruleOrder,
                allShifts,
                protectedDates.get(employee.id)?.has(date) ?? false,
            );
            if (!candidate) break;
            generated.push({ ...candidate.shift, id: nextShiftId(
                Number(date.slice(0, 4)), Number(date.slice(5, 7)),
            ) });
        }
    }
}

export function generateShifts(
    employees: Employee[],
    vacations: VacationPeriod[],
    storeHours: StoreHours,
    year: number,
    month: number,
    existingShifts: readonly Shift[],
    schedulingRules: SchedulingRuleSettings = DEFAULT_SCHEDULING_RULE_SETTINGS,
    sicknesses: readonly SicknessPeriod[] = [],
): GenerationResult {
    resetShiftIdCounter();

    const active = activeEmployees(employees);
    const blockedPeriods = [...vacations, ...sicknesses];
    const generated: Shift[] = [];
    const protectedDates = protectedSaturdayDates(
        active, blockedPeriods, storeHours, year, month,
    );
    const requiredOrder = REQUIRED_RULE_EXECUTION_ORDER.filter((rule) =>
        schedulingRules.modes[rule] === "require");
    const ruleOrder: PlanningRuleId[] = [...requiredOrder, ...preferredRules(schedulingRules)];
    const protectSaturdayFromCoverage =
        schedulingRules.modes["one-saturday-off-per-month"] === "require" ||
        rulePrecedes(ruleOrder, "one-saturday-off-per-month", "opening-hours-coverage");

    const openDays = getOpenOperatingDays(storeHours);
    for (const weekStart of getWeekStartsForMonth(year, month, openDays)) {
        const lastOpenDayOffset = Math.max(
            ...openDays.map((day) => (day + 6) % 7),
        );
        const weekEnd = addDays(weekStart, lastOpenDayOffset);
        const dates = datesInPlanningWeek(
            weekStart, year, month, openDays,
        );
        const weeklyTargets = new Map(active.map((employee) => [
            employee.id,
            getAdjustedWeeklyTargetMinutes(employee, vacations, weekStart, weekEnd),
        ]));

        for (const date of dates) {
            const dayOfWeek = getDayOfWeek(date);
            if (!openDays.some((day) => day === dayOfWeek)) continue;

            while (true) {
                const allShifts = [...existingShifts, ...generated];
                const gaps = coverageGaps(active, blockedPeriods, storeHours, allShifts, date, year, month);
                if (gaps.length === 0) break;
                if (extendShiftForSmallCoverageGap(
                    active,
                    blockedPeriods,
                    storeHours,
                    generated,
                    existingShifts,
                    date,
                    weekStart,
                    weeklyTargets,
                    gaps,
                    schedulingRules,
                )) continue;

                const candidates = active.flatMap((employee): ShiftCandidate[] => {
                    if (!employee.availability.days.includes(dayOfWeek) ||
                        overlapsVacation(blockedPeriods, employee.id, date, date) ||
                        (protectSaturdayFromCoverage &&
                            protectedDates.get(employee.id)?.has(date)) ||
                        allShifts.some((shift) => shift.employeeId === employee.id && shift.date === date)) {
                        return [];
                    }
                    const employeeWeek = generatedForEmployeeInWeek(allShifts, employee.id, weekStart);
                    const daysWorked = new Set(employeeWeek.map((shift) => shift.date)).size;
                    if (daysWorked >= employee.maxDaysPerWeek) return [];
                    const weeklyTarget = weeklyTargets.get(employee.id) ?? 0;
                    const scheduled = employeeWeek.reduce(
                        (total, shift) => total + getShiftDurationMinutes(shift), 0,
                    );
                    const remaining = Math.min(
                        weeklyTarget - scheduled,
                        remainingEmployeeScheduledMinutesForDate(employee, allShifts, date),
                    );
                    const remainingDates = usableDatesRemaining(
                        employee, blockedPeriods, dates, date, daysWorked,
                    );
                    const candidate = bestShiftForEmployee(
                        employee,
                        date,
                        storeHours,
                        gaps,
                        remaining,
                        remainingDates,
                        schedulingRules.minimumGeneratedShiftMinutes,
                        ruleOrder,
                        allShifts,
                        protectedDates.get(employee.id)?.has(date) ?? false,
                    );
                    return candidate ? [{
                        ...candidate,
                        softRuleProtected: protectedDates.get(employee.id)?.has(date) ?? false,
                    }] : [];
                }).sort((left, right) =>
                    compareCoverageCandidates(left, right, gaps, storeHours, ruleOrder),
                );

                const selected = candidates[0];
                if (!selected) break;
                generated.push({
                    ...selected.shift,
                    id: nextShiftId(year, month),
                });
            }
        }

        fulfillWeeklyTargets(
            active,
            blockedPeriods,
            storeHours,
            generated,
            existingShifts,
            dates,
            weekStart,
            weeklyTargets,
            protectedDates,
            schedulingRules,
            ruleOrder,
        );
    }

    return { shifts: generated };
}
