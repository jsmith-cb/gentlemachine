import { getShiftDurationMinutes } from "./hoursService";
import type { Employee, Shift } from "../types/planning";

/** Standard shift ceiling until an explicit overtime policy exists. */
export const MAXIMUM_STANDARD_SHIFT_MINUTES = 8 * 60;
export const DEFAULT_MAXIMUM_SCHEDULED_MINUTES_PER_DAY = 8 * 60;
export const DAILY_MAXIMUM_INCREMENT_MINUTES = 30;

export function isValidMaximumScheduledMinutesPerDayOverride(
    value: unknown,
): value is number {
    return Number.isInteger(value) &&
        (value as number) >= DAILY_MAXIMUM_INCREMENT_MINUTES &&
        (value as number) <= DEFAULT_MAXIMUM_SCHEDULED_MINUTES_PER_DAY &&
        (value as number) % DAILY_MAXIMUM_INCREMENT_MINUTES === 0;
}

export function getEffectiveMaximumScheduledMinutesPerDay(employee: Employee): number {
    return Math.min(
        DEFAULT_MAXIMUM_SCHEDULED_MINUTES_PER_DAY,
        employee.maximumPaidMinutesPerDay ?? DEFAULT_MAXIMUM_SCHEDULED_MINUTES_PER_DAY,
    );
}

export function exceedsMaximumStandardShift(shift: Shift): boolean {
    return getShiftDurationMinutes(shift) > MAXIMUM_STANDARD_SHIFT_MINUTES;
}

export function getEmployeeScheduledMinutesForDate(
    shifts: readonly Shift[], employeeId: string, date: string,
): number {
    return shifts.filter((shift) =>
        shift.employeeId === employeeId && shift.date === date,
    ).reduce((total, shift) => total + getShiftDurationMinutes(shift), 0);
}

export function remainingEmployeeScheduledMinutesForDate(
    employee: Employee, shifts: readonly Shift[], date: string,
): number {
    return Math.max(
        0,
        getEffectiveMaximumScheduledMinutesPerDay(employee) -
            getEmployeeScheduledMinutesForDate(shifts, employee.id, date),
    );
}

export function exceedsEmployeeDailyScheduledMaximum(
    employee: Employee, shifts: readonly Shift[], date: string,
): boolean {
    return getEmployeeScheduledMinutesForDate(shifts, employee.id, date) >
        getEffectiveMaximumScheduledMinutesPerDay(employee);
}

export function shiftsWithCandidate(
    shifts: readonly Shift[], candidate: Shift,
): Shift[] {
    const replaced = shifts.some(({ id }) => id === candidate.id);
    return [
        ...shifts.map((shift) => shift.id === candidate.id ? candidate : shift),
        ...(replaced ? [] : [candidate]),
    ];
}
