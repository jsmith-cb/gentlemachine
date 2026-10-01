import { employeeFullName } from "../services/employeeIdentity";
import {
    getDayOfWeek,
    isDateInMonth,
} from "../services/hoursService";
import {
    getStoredEmployees,
    getStoredStoreHours,
    getStoredShifts,
} from "../services/storageService";
import { buildScheduleWeeks } from "../services/scheduleService";
import type { ScheduleCell, ScheduleWeek } from "../services/scheduleService";
import {
    buildScheduleExportDocument,
    downloadSchedulePdf,
} from "../services/scheduleExportService";

import type { Employee, Shift } from "../types/planning";

export { buildScheduleWeeks } from "../services/scheduleService";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
] as const;

const SHORT_MONTH_NAMES = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function scheduleFilterEmployees(
    employees: readonly Employee[],
    shifts: readonly Shift[],
    year: number,
    month: number,
    additionalScheduledEmployeeIds: readonly string[] = [],
): Employee[] {
    const scheduledIds = new Set(
        shifts
            .filter((shift) => isDateInMonth(shift.date, year, month))
            .map(({ employeeId }) => employeeId),
    );
    additionalScheduledEmployeeIds.forEach((id) => scheduledIds.add(id));

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
    if (!cell.inScheduleScope) {
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
                                        class="${column.inScheduleScope ? "" : "schedule-column-outside"}"
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
                                    <td class="${cell.inScheduleScope ? "" : "schedule-cell--outside"}">
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
        const teamWeeks = buildScheduleWeeks(
            shifts,
            employees,
            selectedYear,
            selectedMonth,
            null,
            storeHours,
            { includeBoundaryWeekShifts: true },
        );
        const scheduledEmployeeIds = teamWeeks.flatMap(({ rows }) =>
            rows.map(({ employeeId }) => employeeId));
        const filterEmployees = scheduleFilterEmployees(
            employees, shifts, selectedYear, selectedMonth, scheduledEmployeeIds,
        );
        if (selectedEmployeeId && !employees.some(({ id }) => id === selectedEmployeeId)) {
            selectedEmployeeId = null;
        }
        const selectedEmployee = selectedEmployeeId
            ? employees.find(({ id }) => id === selectedEmployeeId)
            : undefined;
        const weeks = selectedEmployeeId
            ? buildScheduleWeeks(
                shifts,
                employees,
                selectedYear,
                selectedMonth,
                selectedEmployeeId,
                storeHours,
                { includeBoundaryWeekShifts: true },
            )
            : teamWeeks;
        const displayedFilterEmployees = selectedEmployee &&
            !filterEmployees.some(({ id }) => id === selectedEmployee.id)
            ? [...filterEmployees, selectedEmployee].sort((left, right) =>
                employeeFullName(left).localeCompare(employeeFullName(right), undefined, {
                    sensitivity: "base",
                }) || left.id.localeCompare(right.id),
            )
            : filterEmployees;
        container.innerHTML = `
            <section class="schedule-page">
                <div class="planner-intro schedule-intro">
                    <div>
                        <p class="section-label">Team schedule</p>
                        <h2>${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}</h2>
                    </div>
                    <div class="schedule-heading-actions">
                        <button class="secondary-button schedule-export-button" data-schedule-action="export" type="button">
                            Export PDF
                        </button>
                        <div class="month-navigation">
                            <button class="month-button" data-schedule-action="previous" type="button" aria-label="Previous month">←</button>
                            <button class="month-button month-button--today" data-schedule-action="today" type="button">Today</button>
                            <button class="month-button" data-schedule-action="next" type="button" aria-label="Next month">→</button>
                        </div>
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
        container.querySelector<HTMLButtonElement>('[data-schedule-action="export"]')
            ?.addEventListener("click", () => {
                void downloadSchedulePdf(buildScheduleExportDocument(
                    shifts,
                    employees,
                    storeHours,
                    selectedYear,
                    selectedMonth,
                    selectedEmployeeId
                        ? { scope: "employee", employeeId: selectedEmployeeId }
                        : { scope: "team" },
                ));
            });
        container.querySelector<HTMLSelectElement>("#schedule-employee-filter")
            ?.addEventListener("change", (event) => {
                selectedEmployeeId = (event.currentTarget as HTMLSelectElement).value || null;
                render();
            });
    }

    render();
}
