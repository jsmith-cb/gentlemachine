import {
    availableHoursForDay,
} from "./availabilityService";
import {
    getDayOfWeek,
    getWeekStartDate,
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

function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

function maxTime(a: string, b: string): string {
    return timeToMinutes(a) >= timeToMinutes(b) ? a : b;
}

function minTime(a: string, b: string): string {
    return timeToMinutes(a) <= timeToMinutes(b) ? a : b;
}

let shiftIdCounter = 0;

export function resetShiftIdCounter(): void {
    shiftIdCounter = 0;
}

function nextShiftId(): string {
    shiftIdCounter += 1;
    return `generated-shift-${shiftIdCounter}`;
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
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const generated: Shift[] = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayOfWeek = getDayOfWeek(date);

        for (const employee of active) {
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

            const { earliestStart, latestEnd } = availableHoursForDay(employee.availability, dayOfWeek);

            const start = earliestStart ? maxTime(earliestStart, storeHours.open) : storeHours.open;
            const end = latestEnd ? minTime(latestEnd, storeHours.close) : storeHours.close;

            if (start >= end) {
                continue;
            }

            const shift: Shift = {
                id: nextShiftId(),
                employeeId: employee.id,
                date,
                start,
                end,
            };

            generated.push(shift);
        }
    }

    return { shifts: generated };
}