import { employeeFullName } from "../services/employeeIdentity";
import {
    getDayOfWeek,
    getWeekStartDate,
    isDateInMonth,
    timeToMinutes,
} from "../services/hoursService";
import {
    getStoredEmployees,
    getStoredStoreHours,
    getStoredShifts,
} from "../services/storageService";
import { getOpenOperatingDays } from "../services/storeHoursService";

import type { Employee, Shift } from "../types/planning";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
] as const;

const SHORT_MONTH_NAMES = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

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

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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
    openDays: readonly number[],
): ScheduleWeek[] {
    const operatingDays = orderedOpenDays(openDays);
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
                            .filter((shift) =>
                                shift.employeeId === id && shift.date === column.date,
                            )
                            .sort(compareShifts)
                        : [],
                })),
            })),
        };
    });
}

export function scheduleFilterEmployees(
    employees: readonly Employee[],
    shifts: readonly Shift[],
    year: number,
    month: number,
): Employee[] {
    const scheduledIds = new Set(
        shifts
            .filter((shift) => isDateInMonth(shift.date, year, month))
            .map(({ employeeId }) => employeeId),
    );

    return employees
        .filter((employee) => employee.status === "active" || scheduledIds.has(employee.id))
        .sort((left, right) =>
            employeeFullName(left).localeCompare(employeeFullName(right), undefined, {
                sensitivity: "base",
            }) || left.id.localeCompare(right.id),
        );
}

function dateParts(date: string): { month: number; day: number } {
    const [, month, day] = date.split("-").map(Number);
    return { month, day };
}

function formatWeekRange(start: string, end: string): string {
    const startParts = dateParts(start);
    const endParts = dateParts(end);
    if (startParts.month === endParts.month) {
        return `${SHORT_MONTH_NAMES[startParts.month - 1]} ${startParts.day} – ${endParts.day}`;
    }
    return `${SHORT_MONTH_NAMES[startParts.month - 1]} ${startParts.day} – ` +
        `${SHORT_MONTH_NAMES[endParts.month - 1]} ${endParts.day}`;
}

function renderShiftCell(cell: ScheduleCell, selectedMonth: number): string {
    if (!cell.inSelectedMonth) {
        return `
            <span class="schedule-cell-outside">
                <span class="schedule-visually-hidden">
                    Outside ${MONTH_NAMES[selectedMonth - 1]} display scope
                </span>
            </span>
        `;
    }
    if (cell.shifts.length === 0) {
        return `<span class="schedule-cell-empty" aria-label="No shift">—</span>`;
    }
    return `
        <div class="schedule-cell-shifts">
            ${cell.shifts.map((shift) => `
                <time class="schedule-shift-block" datetime="${escapeHtml(shift.start)}">
                    ${escapeHtml(shift.start)}–${escapeHtml(shift.end)}
                </time>
            `).join("")}
        </div>
    `;
}

function renderWeek(week: ScheduleWeek, selectedMonth: number): string {
    const headingId = `schedule-week-${week.weekStart}`;
    return `
        <section class="schedule-week" aria-labelledby="${headingId}">
            <h3 id="${headingId}">${formatWeekRange(
                week.displayStart, week.displayEnd,
            )}</h3>
            <div
                class="schedule-matrix-scroll"
                role="region"
                aria-label="${escapeHtml(formatWeekRange(week.displayStart, week.displayEnd))} schedule"
                tabindex="0"
            >
                <table class="schedule-matrix">
                    <thead>
                        <tr>
                            <th class="schedule-employee-heading" scope="col">Team member</th>
                            ${week.columns.map((column) => {
                                const { day } = dateParts(column.date);
                                return `
                                    <th
                                        class="${column.inSelectedMonth ? "" : "schedule-column-outside"}"
                                        scope="col"
                                    >
                                        <span>${DAY_NAMES[getDayOfWeek(column.date)]}</span>
                                        ${day}
                                    </th>
                                `;
                            }).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        ${week.rows.map((row) => `
                            <tr>
                                <th scope="row">${escapeHtml(row.employeeName)}</th>
                                ${row.cells.map((cell) => `
                                    <td class="${cell.inSelectedMonth ? "" : "schedule-cell--outside"}">
                                        ${renderShiftCell(cell, selectedMonth)}
                                    </td>
                                `).join("")}
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function adjacentMonth(year: number, month: number, amount: number): { year: number; month: number } {
    const value = new Date(Date.UTC(year, month - 1 + amount, 1));
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
}

export function renderSchedulePage(container: HTMLElement): void {
    const shifts = getStoredShifts();
    const employees = getStoredEmployees() ?? [];
    const storeHours = getStoredStoreHours();
    const today = new Date();
    let selectedYear = today.getFullYear();
    let selectedMonth = today.getMonth() + 1;
    let selectedEmployeeId: string | null = null;

    function render(): void {
        const filterEmployees = scheduleFilterEmployees(
            employees, shifts, selectedYear, selectedMonth,
        );
        if (selectedEmployeeId && !employees.some(({ id }) => id === selectedEmployeeId)) {
            selectedEmployeeId = null;
        }
        const selectedEmployee = selectedEmployeeId
            ? employees.find(({ id }) => id === selectedEmployeeId)
            : undefined;
        const displayedFilterEmployees = selectedEmployee &&
            !filterEmployees.some(({ id }) => id === selectedEmployee.id)
            ? [...filterEmployees, selectedEmployee].sort((left, right) =>
                employeeFullName(left).localeCompare(employeeFullName(right), undefined, {
                    sensitivity: "base",
                }) || left.id.localeCompare(right.id),
            )
            : filterEmployees;
        const weeks = buildScheduleWeeks(
            shifts,
            employees,
            selectedYear,
            selectedMonth,
            selectedEmployeeId,
            getOpenOperatingDays(storeHours),
        );

        container.innerHTML = `
            <section class="schedule-page">
                <div class="planner-intro schedule-intro">
                    <div>
                        <p class="section-label">Team schedule</p>
                        <h2>${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}</h2>
                    </div>
                    <div class="month-navigation">
                        <button class="month-button" data-schedule-action="previous" type="button" aria-label="Previous month">←</button>
                        <button class="month-button month-button--today" data-schedule-action="today" type="button">Today</button>
                        <button class="month-button" data-schedule-action="next" type="button" aria-label="Next month">→</button>
                    </div>
                </div>

                <div class="schedule-toolbar">
                    <label for="schedule-employee-filter">Team member</label>
                    <select id="schedule-employee-filter">
                        <option value="">All team members</option>
                        ${displayedFilterEmployees.map((employee) => `
                            <option value="${escapeHtml(employee.id)}" ${employee.id === selectedEmployeeId ? "selected" : ""}>
                                ${escapeHtml(employeeFullName(employee))}${employee.status === "inactive" ? " (Inactive)" : ""}
                            </option>
                        `).join("")}
                    </select>
                </div>

                ${selectedEmployee ? `
                    <p class="schedule-filter-context">
                        Showing schedule for <strong>${escapeHtml(employeeFullName(selectedEmployee))}</strong>
                    </p>
                ` : ""}

                <div class="schedule-content">
                    ${weeks.length
                        ? weeks.map((week) => renderWeek(week, selectedMonth)).join("")
                        : `<div class="schedule-empty-state">
                            <h3>No shifts scheduled for this month.</h3>
                            <p>${selectedEmployee
                                ? `${escapeHtml(employeeFullName(selectedEmployee))} has no shifts in this month.`
                                : "The team schedule is currently empty for this month."}</p>
                        </div>`}
                </div>
            </section>
        `;

        container.querySelector<HTMLButtonElement>('[data-schedule-action="previous"]')
            ?.addEventListener("click", () => {
                ({ year: selectedYear, month: selectedMonth } = adjacentMonth(
                    selectedYear, selectedMonth, -1,
                ));
                render();
            });
        container.querySelector<HTMLButtonElement>('[data-schedule-action="next"]')
            ?.addEventListener("click", () => {
                ({ year: selectedYear, month: selectedMonth } = adjacentMonth(
                    selectedYear, selectedMonth, 1,
                ));
                render();
            });
        container.querySelector<HTMLButtonElement>('[data-schedule-action="today"]')
            ?.addEventListener("click", () => {
                const current = new Date();
                selectedYear = current.getFullYear();
                selectedMonth = current.getMonth() + 1;
                render();
            });
        container.querySelector<HTMLSelectElement>("#schedule-employee-filter")
            ?.addEventListener("change", (event) => {
                selectedEmployeeId = (event.currentTarget as HTMLSelectElement).value || null;
                render();
            });
    }

    render();
}
