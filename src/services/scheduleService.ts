import { employeeFullName } from "./employeeIdentity";
import {
    getDayOfWeek,
    getWeekStartDate,
    isDateInMonth,
    timeToMinutes,
} from "./hoursService";
import { getOpenOperatingDays } from "./storeHoursService";

import type { Employee, Shift, StoreHours } from "../types/planning";

export interface ScheduleColumn {
    date: string;
    inSelectedMonth: boolean;
}

export interface ScheduleCell extends ScheduleColumn {
    shifts: Shift[];
}

export interface ScheduleRow {
    employeeId: string;
    employeeName: string;
    cells: ScheduleCell[];
}

export interface ScheduleWeek {
    weekStart: string;
    displayStart: string;
    displayEnd: string;
    columns: ScheduleColumn[];
    rows: ScheduleRow[];
}

function addDays(date: string, amount: number): string {
    const [year, month, day] = date.split("-").map(Number);
    const value = new Date(Date.UTC(year, month - 1, day + amount));
    return [
        value.getUTCFullYear(),
        String(value.getUTCMonth() + 1).padStart(2, "0"),
        String(value.getUTCDate()).padStart(2, "0"),
    ].join("-");
}

function orderedOpenDays(openDays: readonly number[]): number[] {
    return [...new Set(openDays)]
        .sort((left, right) => ((left + 6) % 7) - ((right + 6) % 7));
}

function employeeName(employeeId: string, employees: readonly Employee[]): string {
    const employee = employees.find(({ id }) => id === employeeId);
    return employee ? employeeFullName(employee) : "Unknown team member";
}

function compareShifts(left: Shift, right: Shift): number {
    return timeToMinutes(left.start) - timeToMinutes(right.start) ||
        timeToMinutes(left.end) - timeToMinutes(right.end) ||
        left.id.localeCompare(right.id);
}

function compareEmployeeIds(
    leftId: string,
    rightId: string,
    employees: readonly Employee[],
): number {
    return employeeName(leftId, employees).localeCompare(
        employeeName(rightId, employees),
        undefined,
        { sensitivity: "base" },
    ) || leftId.localeCompare(rightId);
}

export function buildScheduleWeeks(
    shifts: readonly Shift[],
    employees: readonly Employee[],
    year: number,
    month: number,
    employeeId: string | null,
    storeHours: StoreHours,
): ScheduleWeek[] {
    const operatingDays = orderedOpenDays(getOpenOperatingDays(storeHours));
    if (operatingDays.length === 0) return [];

    const monthShifts = shifts.filter((shift) =>
        isDateInMonth(shift.date, year, month) &&
        operatingDays.includes(getDayOfWeek(shift.date)) &&
        (employeeId === null || shift.employeeId === employeeId),
    );
    const weekStarts = [...new Set(monthShifts.map(({ date }) => getWeekStartDate(date)))].sort();

    return weekStarts.map((weekStart) => {
        const columns = operatingDays.map((day) => {
            const date = addDays(weekStart, (day + 6) % 7);
            return {
                date,
                inSelectedMonth: isDateInMonth(date, year, month),
            };
        });
        const weekShifts = monthShifts.filter(
            ({ date }) => getWeekStartDate(date) === weekStart,
        );
        const employeeIds = [...new Set(weekShifts.map(({ employeeId: id }) => id))]
            .sort((left, right) => compareEmployeeIds(left, right, employees));

        return {
            weekStart,
            displayStart: columns[0]!.date,
            displayEnd: columns[columns.length - 1]!.date,
            columns,
            rows: employeeIds.map((id) => ({
                employeeId: id,
                employeeName: employeeName(id, employees),
                cells: columns.map((column) => ({
                    ...column,
                    shifts: column.inSelectedMonth
                        ? weekShifts
                            .filter((shift) => shift.employeeId === id && shift.date === column.date)
                            .sort(compareShifts)
                        : [],
                })),
            })),
        };
    });
}
