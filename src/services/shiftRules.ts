import { getPaidShiftMinutes, getShiftDurationMinutes } from "./hoursService";
import type { Employee, Shift } from "../types/planning";

/** Standard shift ceiling until an explicit overtime policy exists. */
export const MAXIMUM_STANDARD_SHIFT_MINUTES = 8 * 60;
export const DEFAULT_MAXIMUM_PAID_MINUTES_PER_DAY = 8 * 60;
export const DAILY_MAXIMUM_INCREMENT_MINUTES = 30;

export function isValidMaximumPaidMinutesPerDayOverride(
    value: unknown,
): value is number {
    return Number.isInteger(value) &&
        (value as number) >= DAILY_MAXIMUM_INCREMENT_MINUTES &&
        (value as number) <= DEFAULT_MAXIMUM_PAID_MINUTES_PER_DAY &&
        (value as number) % DAILY_MAXIMUM_INCREMENT_MINUTES === 0;
}

export function getEffectiveMaximumPaidMinutesPerDay(employee: Employee): number {
    return Math.min(
        DEFAULT_MAXIMUM_PAID_MINUTES_PER_DAY,
        employee.maximumPaidMinutesPerDay ?? DEFAULT_MAXIMUM_PAID_MINUTES_PER_DAY,
    );
}

export function exceedsMaximumStandardShift(shift: Shift): boolean {
    return getShiftDurationMinutes(shift) > MAXIMUM_STANDARD_SHIFT_MINUTES;
}

export function getEmployeePaidMinutesForDate(
    shifts: readonly Shift[], employeeId: string, date: string,
): number {
    return shifts.filter((shift) =>
        shift.employeeId === employeeId && shift.date === date,
    ).reduce((total, shift) => total + getPaidShiftMinutes(shift), 0);
}

export function remainingEmployeePaidMinutesForDate(
    employee: Employee, shifts: readonly Shift[], date: string,
): number {
    return Math.max(
        0,
        getEffectiveMaximumPaidMinutesPerDay(employee) -
            getEmployeePaidMinutesForDate(shifts, employee.id, date),
    );
}

export function exceedsEmployeeDailyPaidMaximum(
    employee: Employee, shifts: readonly Shift[], date: string,
): boolean {
    return getEmployeePaidMinutesForDate(shifts, employee.id, date) >
        getEffectiveMaximumPaidMinutesPerDay(employee);
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
