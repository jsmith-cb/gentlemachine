import { availableHoursForDay } from "./availabilityService";
import {
    createDateKey,
    getAdjustedWeeklyTargetMinutes,
    getDayOfWeek,
    getPaidShiftMinutes,
    getWeekStartsForMonth,
    getWeekStartDate,
    minutesToTime,
    timeToMinutes,
} from "./hoursService";
import { getCoverageGapsForDate } from "./coverageService";
import { overlapsVacation } from "./vacationService";
import { activeEmployees } from "./teamService";

import type {
    Employee,
    PlannerState,
    Shift,
    StoreHours,
    VacationPeriod,
} from "../types/planning";

export interface GenerationResult {
    shifts: Shift[];
}

export type GenerationFlexibility = "hour-constrained" | "day-constrained" | "general";

const NORMAL_PLANNING_DAYS = [1, 2, 3, 4, 5, 6] as const;
const MINIMUM_GENERATED_FINAL_SHIFT_PAID_MINUTES = 2 * 60;
const GENERATION_SLOT_MINUTES = 30;

function maxTime(a: string, b: string): string {
    return timeToMinutes(a) >= timeToMinutes(b) ? a : b;
}

function minTime(a: string, b: string): string {
    return timeToMinutes(a) <= timeToMinutes(b) ? a : b;
}

function legalWindow(employee: Employee, day: number, storeHours: StoreHours): { start: string; end: string } {
    const { earliestStart, latestEnd } = availableHoursForDay(employee.availability, day);
    return {
        start: earliestStart ? maxTime(earliestStart, storeHours.open) : storeHours.open,
        end: latestEnd ? minTime(latestEnd, storeHours.close) : storeHours.close,
    };
}

export function classifyGenerationFlexibility(
    employee: Employee,
    storeHours: StoreHours,
): GenerationFlexibility {
    const hourConstrained = employee.availability.days.some((day) => {
        const { start, end } = legalWindow(employee, day, storeHours);
        return start !== storeHours.open || end !== storeHours.close;
    });
    if (hourConstrained) return "hour-constrained";

    const availableDays = new Set(employee.availability.days);
    if (NORMAL_PLANNING_DAYS.some((day) => !availableDays.has(day))) return "day-constrained";
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
): string[] {
    return Array.from({ length: 6 }, (_, offset) => addDays(weekStart, offset))
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

interface ShiftCandidate {
    employee: Employee;
    shift: Shift;
    coverageMinutes: number;
    remainingRatio: number;
}

function bestShiftForEmployee(
    employee: Employee,
    date: string,
    storeHours: StoreHours,
    gaps: Array<{ start: string; end: string }>,
    remainingWeeklyMinutes: number,
    remainingUsableDates: number,
): ShiftCandidate | null {
    if (remainingUsableDates === 0 ||
        remainingWeeklyMinutes < MINIMUM_GENERATED_FINAL_SHIFT_PAID_MINUTES) return null;

    const window = legalWindow(employee, getDayOfWeek(date), storeHours);
    const windowStart = roundUpToSlot(timeToMinutes(window.start));
    const windowEnd = roundDownToSlot(timeToMinutes(window.end));
    if (windowEnd - windowStart < MINIMUM_GENERATED_FINAL_SHIFT_PAID_MINUTES) return null;

    const plannedSlots = Math.min(
        remainingUsableDates,
        Math.floor(remainingWeeklyMinutes / MINIMUM_GENERATED_FINAL_SHIFT_PAID_MINUTES),
    );
    if (plannedSlots === 0) return null;

    const dailyPaidBudget = Math.min(
        remainingWeeklyMinutes,
        Math.ceil(remainingWeeklyMinutes / plannedSlots / GENERATION_SLOT_MINUTES) *
            GENERATION_SLOT_MINUTES,
    );
    let best: Shift | null = null;
    let bestCoverage = 0;
    let bestPaid = 0;

    for (let start = windowStart; start < windowEnd; start += GENERATION_SLOT_MINUTES) {
        for (
            let end = start + MINIMUM_GENERATED_FINAL_SHIFT_PAID_MINUTES;
            end <= windowEnd;
            end += GENERATION_SLOT_MINUTES
        ) {
            const candidate: Shift = {
                id: "candidate",
                employeeId: employee.id,
                date,
                start: minutesToTime(start),
                end: minutesToTime(end),
            };
            const paid = getPaidShiftMinutes(candidate);
            if (paid > dailyPaidBudget || paid > remainingWeeklyMinutes) continue;
            const coverage = overlapMinutes(start, end, gaps);
            if (coverage > bestCoverage ||
                (coverage === bestCoverage && paid > bestPaid) ||
                (coverage === bestCoverage && paid === bestPaid && best && start < timeToMinutes(best.start))) {
                best = candidate;
                bestCoverage = coverage;
                bestPaid = paid;
            }
        }
    }

    if (!best || bestCoverage === 0) return null;
    return {
        employee,
        shift: best,
        coverageMinutes: bestCoverage,
        remainingRatio: remainingWeeklyMinutes / Math.max(employee.weeklyTargetMinutes, 1),
    };
}

function coverageGaps(
    employees: Employee[],
    vacations: VacationPeriod[],
    storeHours: StoreHours,
    generated: Shift[],
    date: string,
    year: number,
    month: number,
): Array<{ start: string; end: string }> {
    const state: PlannerState = {
        selectedYear: year,
        selectedMonth: month,
        storeHours,
        employees,
        shifts: generated,
        vacations,
    };
    return getCoverageGapsForDate(state, date);
}

export function generateShifts(
    employees: Employee[],
    vacations: VacationPeriod[],
    storeHours: StoreHours,
    year: number,
    month: number,
): GenerationResult {
    resetShiftIdCounter();

    const active = activeEmployees(employees);
    const generated: Shift[] = [];

    for (const weekStart of getWeekStartsForMonth(year, month)) {
        const weekEnd = addDays(weekStart, 5);
        const dates = datesInPlanningWeek(weekStart, year, month);
        const weeklyTargets = new Map(active.map((employee) => [
            employee.id,
            getAdjustedWeeklyTargetMinutes(employee, vacations, weekStart, weekEnd),
        ]));

        for (const date of dates) {
            const dayOfWeek = getDayOfWeek(date);
            if (dayOfWeek === 0) continue;

            while (true) {
                const gaps = coverageGaps(active, vacations, storeHours, generated, date, year, month);
                if (gaps.length === 0) break;

                const candidates = active.flatMap((employee): ShiftCandidate[] => {
                    if (!employee.availability.days.includes(dayOfWeek) ||
                        overlapsVacation(vacations, employee.id, date, date) ||
                        generated.some((shift) => shift.employeeId === employee.id && shift.date === date)) {
                        return [];
                    }
                    const employeeWeek = generatedForEmployeeInWeek(generated, employee.id, weekStart);
                    const daysWorked = new Set(employeeWeek.map((shift) => shift.date)).size;
                    if (daysWorked >= employee.maxDaysPerWeek) return [];
                    const weeklyTarget = weeklyTargets.get(employee.id) ?? 0;
                    const scheduled = employeeWeek.reduce(
                        (total, shift) => total + getPaidShiftMinutes(shift), 0,
                    );
                    const remaining = weeklyTarget - scheduled;
                    const remainingDates = usableDatesRemaining(
                        employee, vacations, dates, date, daysWorked,
                    );
                    const candidate = bestShiftForEmployee(
                        employee,
                        date,
                        storeHours,
                        gaps,
                        remaining,
                        remainingDates,
                    );
                    return candidate ? [candidate] : [];
                }).sort((left, right) => {
                    const flexibility = FLEXIBILITY_RANK[
                        classifyGenerationFlexibility(left.employee, storeHours)
                    ] - FLEXIBILITY_RANK[
                        classifyGenerationFlexibility(right.employee, storeHours)
                    ];
                    return flexibility ||
                        right.remainingRatio - left.remainingRatio ||
                        right.coverageMinutes - left.coverageMinutes ||
                        left.employee.id.localeCompare(right.employee.id);
                });

                const selected = candidates[0];
                if (!selected) break;
                generated.push({
                    ...selected.shift,
                    id: nextShiftId(year, month),
                });
            }
        }
    }

    return { shifts: generated };
}
