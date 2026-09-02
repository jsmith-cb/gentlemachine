import { BREAK_RULES } from "../state/plannerState";

import type {
    EmployeeMonthSummary,
    PlannerState,
    Shift,
} from "../types/planning";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function timeToMinutes(time: string): number {
    const [hoursText, minutesText] = time.split(":");

    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        throw new Error(`Invalid time: ${time}`);
    }

    return hours * MINUTES_PER_HOUR + minutes;
}

export function getShiftDurationMinutes(shift: Shift): number {
    const startMinutes = timeToMinutes(shift.start);
    const endMinutes = timeToMinutes(shift.end);

    if (endMinutes <= startMinutes) {
        return 0;
    }

    return Math.min(
        endMinutes - startMinutes,
        MINUTES_PER_DAY,
    );
}

export function getBreakMinutes(
    shiftDurationMinutes: number,
): number {
    const rule = BREAK_RULES.find(
        ({ minimumShiftMinutes }) =>
            shiftDurationMinutes >= minimumShiftMinutes,
    );

    return rule?.breakMinutes ?? 0;
}

export function getPaidShiftMinutes(shift: Shift): number {
    const durationMinutes = getShiftDurationMinutes(shift);
    const breakMinutes = getBreakMinutes(durationMinutes);

    return Math.max(
        durationMinutes - breakMinutes,
        0,
    );
}

export function getEmployeeScheduledMinutes(
    employeeId: string,
    shifts: Shift[],
): number {
    return shifts
        .filter(
            (shift) => shift.employeeId === employeeId,
        )
        .reduce(
            (total, shift) =>
                total + getPaidShiftMinutes(shift),
            0,
        );
}

export function getEmployeeDaysWorked(
    employeeId: string,
    shifts: Shift[],
): number {
    const datesWorked = new Set(
        shifts
            .filter(
                (shift) =>
                    shift.employeeId === employeeId,
            )
            .map((shift) => shift.date),
    );

    return datesWorked.size;
}

export function getEmployeeSaturdaysWorked(
    employeeId: string,
    shifts: Shift[],
): number {
    const saturdaysWorked = new Set(
        shifts
            .filter(
                (shift) =>
                    shift.employeeId === employeeId &&
                    getDayOfWeek(shift.date) === 6,
            )
            .map((shift) => shift.date),
    );

    return saturdaysWorked.size;
}

export function getMonthShifts(
    shifts: Shift[],
    year: number,
    month: number,
): Shift[] {
    return shifts.filter((shift) =>
        isDateInMonth(
            shift.date,
            year,
            month,
        ),
    );
}

export function getEmployeeMonthSummaries(
    state: PlannerState,
): EmployeeMonthSummary[] {
    const monthShifts = getMonthShifts(
        state.shifts,
        state.selectedYear,
        state.selectedMonth,
    );

    return state.employees.map((employee) => ({
        employeeId: employee.id,

        scheduledMinutes:
            getEmployeeScheduledMinutes(
                employee.id,
                monthShifts,
            ),

        daysWorked:
            getEmployeeDaysWorked(
                employee.id,
                monthShifts,
            ),

        saturdaysWorked:
            getEmployeeSaturdaysWorked(
                employee.id,
                monthShifts,
            ),
    }));
}

export function getWeekStartDate(
    date: string,
): string {
    const {
        year,
        month,
        day,
    } = parseDateKey(date);

    const value = new Date(
        Date.UTC(
            year,
            month - 1,
            day,
        ),
    );

    const dayOfWeek = value.getUTCDay();

    const daysSinceMonday =
        (dayOfWeek + 6) % 7;

    value.setUTCDate(
        value.getUTCDate() -
            daysSinceMonday,
    );

    return formatUtcDate(value);
}

export function getDayOfWeek(
    date: string,
): number {
    const {
        year,
        month,
        day,
    } = parseDateKey(date);

    return new Date(
        Date.UTC(
            year,
            month - 1,
            day,
        ),
    ).getUTCDay();
}

export function isDateInMonth(
    date: string,
    year: number,
    month: number,
): boolean {
    const parsed = parseDateKey(date);

    return (
        parsed.year === year &&
        parsed.month === month
    );
}

export function formatMinutes(
    totalMinutes: number,
): string {
    const sign =
        totalMinutes < 0 ? "-" : "";

    const absoluteMinutes =
        Math.abs(totalMinutes);

    const hours = Math.floor(
        absoluteMinutes /
            MINUTES_PER_HOUR,
    );

    const minutes =
        absoluteMinutes %
        MINUTES_PER_HOUR;

    return `${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

function parseDateKey(date: string): {
    year: number;
    month: number;
    day: number;
} {
    const match =
        /^(\d{4})-(\d{2})-(\d{2})$/.exec(
            date,
        );

    if (!match) {
        throw new Error(
            `Invalid date: ${date}`,
        );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const value = new Date(
        Date.UTC(
            year,
            month - 1,
            day,
        ),
    );

    if (
        value.getUTCFullYear() !== year ||
        value.getUTCMonth() + 1 !== month ||
        value.getUTCDate() !== day
    ) {
        throw new Error(
            `Invalid date: ${date}`,
        );
    }

    return {
        year,
        month,
        day,
    };
}

function formatUtcDate(
    date: Date,
): string {
    const year =
        date.getUTCFullYear();

    const month = String(
        date.getUTCMonth() + 1,
    ).padStart(2, "0");

    const day = String(
        date.getUTCDate(),
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}