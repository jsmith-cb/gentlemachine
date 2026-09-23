import { availableHoursForDay } from "./availabilityService";
import {
    getAdjustedMonthlyTargetMinutes,
    getDayOfWeek,
    getPaidShiftMinutes,
    getWeekStartDate,
    minutesToTime,
    timeToMinutes,
} from "./hoursService";
import { overlapsVacation } from "./vacationService";
import { activeEmployees } from "./teamService";

import type {
    Employee,
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

function nextShiftId(): string {
    shiftIdCounter += 1;
    return `generated-shift-${shiftIdCounter}`;
}

function shortenedShiftForRemainingTarget(
    employeeId: string,
    date: string,
    start: string,
    end: string,
    remainingPaidMinutes: number,
): Shift | null {
    if (remainingPaidMinutes < MINIMUM_GENERATED_FINAL_SHIFT_PAID_MINUTES) return null;

    const startMinutes = timeToMinutes(start);
    const maximumDuration = timeToMinutes(end) - startMinutes;
    let bestDuration = 0;
    let bestPaidMinutes = 0;

    for (let duration = 1; duration <= maximumDuration; duration += 1) {
        const candidate: Shift = {
            id: "candidate",
            employeeId,
            date,
            start,
            end: minutesToTime(startMinutes + duration),
        };
        const paidMinutes = getPaidShiftMinutes(candidate);
        if (paidMinutes <= remainingPaidMinutes && paidMinutes > bestPaidMinutes) {
            bestDuration = duration;
            bestPaidMinutes = paidMinutes;
        }
    }

    if (bestPaidMinutes < MINIMUM_GENERATED_FINAL_SHIFT_PAID_MINUTES) return null;
    return {
        id: nextShiftId(),
        employeeId,
        date,
        start,
        end: minutesToTime(startMinutes + bestDuration),
    };
}

export function generateShifts(
    employees: Employee[],
    vacations: VacationPeriod[],
    storeHours: StoreHours,
    year: number,
    month: number,
): GenerationResult {
    resetShiftIdCounter();

    const active = orderEmployeesForGeneration(activeEmployees(employees), storeHours);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const generated: Shift[] = [];

    for (const employee of active) {
        const monthlyTarget = getAdjustedMonthlyTargetMinutes(employee, vacations, year, month);
        let paidMinutes = 0;

        for (let day = 1; day <= daysInMonth; day += 1) {
            const remaining = monthlyTarget - paidMinutes;
            if (remaining < MINIMUM_GENERATED_FINAL_SHIFT_PAID_MINUTES) break;

            const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayOfWeek = getDayOfWeek(date);

            if (!employee.availability.days.includes(dayOfWeek)) {
                continue;
            }

            if (overlapsVacation(vacations, employee.id, date, date)) {
                continue;
            }

            const generatedThisWeek = generated.filter(
                (shift) =>
                    shift.employeeId === employee.id &&
                    getWeekStartDate(shift.date) === getWeekStartDate(date),
            );
            const daysWorkedThisWeek = new Set(generatedThisWeek.map((s) => s.date)).size;
            if (daysWorkedThisWeek >= employee.maxDaysPerWeek) {
                continue;
            }

            const { start, end } = legalWindow(employee, dayOfWeek, storeHours);
            if (timeToMinutes(start) >= timeToMinutes(end)) continue;

            const fullShift: Shift = {
                id: "candidate",
                employeeId: employee.id,
                date,
                start,
                end,
            };
            const fullPaidMinutes = getPaidShiftMinutes(fullShift);
            const shift = fullPaidMinutes <= remaining
                ? { ...fullShift, id: nextShiftId() }
                : shortenedShiftForRemainingTarget(employee.id, date, start, end, remaining);
            if (!shift) break;

            generated.push(shift);
            paidMinutes += getPaidShiftMinutes(shift);
        }
    }

    return { shifts: generated };
}
