import type {
    PlannerState,
    Shift,
    ValidationIssue,
} from "../types/planning";
import { employeeFullName } from "../services/employeeIdentity";
import { vacationEmployeesOnDate } from "../services/vacationService";
import { renderDayPlanningModal } from "./DayPlanningModal";

const OPEN_DAY_LABELS = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
] as const;

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type PlannerEditorMode =
    | {
        type: "add";
        date: string;
    }
    | {
        type: "edit";
        shiftId: string;
    };

export function renderPlannerCalendar(
    state: PlannerState,
    editorMode: PlannerEditorMode | null,
    scheduleIssues: ValidationIssue[],
    assistantOpen = false,
): string {
    return `
        <div class="planner-meta">
            <div class="planner-schedule-facts">
                <p class="store-hours">
                    Store hours
                    <strong>${state.storeHours.open}–${state.storeHours.close}</strong>
                </p>
                <p class="closed-note">Sunday closed</p>
            </div>
            <button class="planning-assistant-trigger" type="button"
                data-action="toggle-planning-assistant" aria-controls="planning-assistant-window"
                aria-expanded="${assistantOpen}">
                <strong>Planning assistant</strong>
                <span>${scheduleIssues.filter(({ severity }) => severity === "error").length} errors · ${scheduleIssues.filter(({ severity }) => severity === "warning").length} warnings</span>
            </button>
        </div>

        <div class="calendar-scroll">
            <div class="calendar">
                <div class="calendar-weekdays">
                    ${OPEN_DAY_LABELS.map(
                        (day) => `
                            <div class="weekday-label">
                                ${day}
                            </div>
                        `,
                    ).join("")}
                </div>

                <div class="calendar-grid">
                    ${renderCalendarDays(state, editorMode)}
                </div>
            </div>
        </div>

        ${editorMode ? renderDayPlanningModal(state, getEditorDate(state, editorMode) ?? "") : ""}
        ${renderPlanningAssistant(scheduleIssues, assistantOpen)}
    `;
}

function renderPlanningAssistant(
    issues: ValidationIssue[],
    isOpen: boolean,
): string {
    const errors = issues.filter(({ severity }) => severity === "error");
    const warnings = issues.filter(({ severity }) => severity === "warning");
    const coverage = issues.filter(({ category }) => category === "coverage");
    const hours = issues.filter(({ category }) => category === "hours");
    const availability = issues.filter(({ category }) => category === "availability");

    return `
        <aside class="planning-assistant-window" id="planning-assistant-window"
            role="dialog" aria-modal="false" aria-labelledby="planning-assistant-title"
            ${isOpen ? "" : "hidden"}>
            <div class="planning-assistant-header" data-assistant-drag-handle>
                <div>
                    <p class="section-label">Planning assistant</p>
                    <h2 id="planning-assistant-title" tabindex="-1">Schedule guidance</h2>
                </div>
                <button type="button" data-action="close-planning-assistant"
                    aria-label="Close Planning assistant">×</button>
            </div>
            <div class="planning-assistant-body">
                <div class="status-counts">
                    <span class="status-count status-count--error">${errors.length} errors</span>
                    <span class="status-count status-count--warning">${warnings.length} warnings</span>
                </div>

            ${issues.length === 0
                ? `
                    <div class="status-clear">
                        No schedule issues found.
                    </div>
                `
                : `
                    <div class="status-details">
                        <div class="validation-filter-bar">
                            ${renderValidationFilter("all", "All", issues.length, true)}
                            ${renderValidationFilter("error", "Errors", errors.length)}
                            ${renderValidationFilter("warning", "Warnings", warnings.length)}
                            ${renderValidationFilter("coverage", "Coverage", coverage.length)}
                            ${renderValidationFilter("hours", "Hours", hours.length)}
                            ${renderValidationFilter("availability", "Availability", availability.length)}
                        </div>

                        <div class="validation-results-heading">
                            <span id="validation-result-count">
                                ${issues.length} issues
                            </span>
                        </div>

                        <div class="status-issues">
                            ${issues.map(renderScheduleIssue).join("")}
                        </div>

                        <p class="coverage-note">
                            Coverage currently checks scheduled shift spans.
                            Break coverage is not yet included.
                        </p>
                    </div>
                `}
            </div>
        </aside>
    `;
}

function renderValidationFilter(
    value: string,
    label: string,
    count: number,
    active = false,
): string {
    return `
        <button
            class="validation-filter${active ? " validation-filter--active" : ""}"
            data-validation-filter="${value}"
            type="button"
            aria-pressed="${active}"
        >
            ${label}
            <span>${count}</span>
        </button>
    `;
}

function renderScheduleIssue(
    issue: ValidationIssue,
): string {
    return `
        <div
            class="schedule-issue schedule-issue--${issue.severity}"
            data-validation-issue
            data-severity="${issue.severity}"
            data-category="${issue.category}"
        >
            <strong>
                ${issue.severity === "error" ? "Error" : "Warning"}
            </strong>

            <span>
                ${issue.date ? `${formatShortDate(issue.date)} · ` : ""}${issue.message}
            </span>
        </div>
    `;
}

function renderCalendarDays(
    state: PlannerState,
    editorMode: PlannerEditorMode | null,
): string {
    const daysInMonth = new Date(
        state.selectedYear,
        state.selectedMonth,
        0,
    ).getDate();
    const openDates: number[] = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(
            state.selectedYear,
            state.selectedMonth - 1,
            day,
        );
        if (date.getDay() !== 0) openDates.push(day);
    }

    const firstOpenDay = openDates[0];
    if (!firstOpenDay) return "";

    const firstDate = new Date(
        state.selectedYear,
        state.selectedMonth - 1,
        firstOpenDay,
    );
    const placeholders = Array.from(
        { length: Math.max(firstDate.getDay() - 1, 0) },
        () => `
            <div
                class="calendar-day calendar-day--placeholder"
                aria-hidden="true"
            ></div>
        `,
    ).join("");

    return placeholders + openDates
        .map((day) => renderCalendarDay(state, day, editorMode))
        .join("");
}

function renderCalendarDay(
    state: PlannerState,
    day: number,
    editorMode: PlannerEditorMode | null,
): string {
    const dateKey = createDateKey(
        state.selectedYear,
        state.selectedMonth,
        day,
    );
    const shifts = state.shifts
        .filter((shift) => shift.date === dateKey)
        .sort((left, right) => left.start.localeCompare(right.start));
    const vacationEmployees = vacationEmployeesOnDate(state.vacations, dateKey)
        .map((employeeId) => state.employees.find((employee) => employee.id === employeeId))
        .filter((employee) => employee !== undefined)
        .sort((a, b) => employeeFullName(a).localeCompare(employeeFullName(b)));
    const selectedClass = getEditorDate(state, editorMode) === dateKey
        ? " calendar-day--selected"
        : "";

    return `
        <article class="calendar-day${selectedClass}">
            <button
                class="calendar-day-add"
                data-add-date="${dateKey}"
                type="button"
            >
                <span class="calendar-day-number">
                    ${day}
                </span>

                <span class="add-shift-label">
                    + Shift
                </span>
            </button>

            <div class="calendar-day-content">
                ${vacationEmployees.map((employee) => `
                    <span class="calendar-vacation" title="${escapeHtml(employeeFullName(employee))} on vacation">
                        ${escapeHtml(employeeFullName(employee))} · Vacation
                    </span>
                `).join("")}
                ${shifts.length === 0 && vacationEmployees.length === 0
                    ? `<span class="no-shifts">No shifts</span>`
                    : shifts.map((shift) => renderShift(state, shift, editorMode)).join("")}
            </div>
        </article>
    `;
}

function renderShift(
    state: PlannerState,
    shift: Shift,
    editorMode: PlannerEditorMode | null,
): string {
    const employee = state.employees.find(({ id }) => id === shift.employeeId);
    const selectedClass = editorMode?.type === "edit"
        && editorMode.shiftId === shift.id
        ? " calendar-shift--selected"
        : "";

    return `
        <button
            class="calendar-shift${selectedClass}"
            data-edit-shift="${shift.id}"
            type="button"
        >
            <strong>
                ${employee ? employeeFullName(employee) : shift.employeeId}
            </strong>

            <span>
                ${shift.start}–${shift.end}
            </span>
        </button>
    `;
}

function getEditorDate(
    state: PlannerState,
    editorMode: PlannerEditorMode | null,
): string | null {
    if (!editorMode) return null;
    if (editorMode.type === "add") return editorMode.date;
    return state.shifts.find(({ id }) => id === editorMode.shiftId)?.date ?? null;
}

function createDateKey(
    year: number,
    month: number,
    day: number,
): string {
    return [
        year,
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0"),
    ].join("-");
}

function formatShortDate(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
    }).format(new Date(year, month - 1, day));
}
