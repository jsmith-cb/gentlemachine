import type {
    PlannerState,
    Shift,
    ValidationIssue,
} from "../types/planning";
import { employeeFullName } from "../services/employeeIdentity";

const OPEN_DAY_LABELS = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
] as const;

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
): string {
    return `
        <div class="planner-meta">
            <p class="store-hours">
                Store hours
                <strong>
                    ${state.storeHours.open}–${state.storeHours.close}
                </strong>
            </p>

            <p class="closed-note">
                Sunday closed
            </p>
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

        ${editorMode ? renderShiftEditor(state, editorMode) : ""}
        ${renderScheduleStatus(scheduleIssues)}
    `;
}

function renderScheduleStatus(
    issues: ValidationIssue[],
): string {
    const errors = issues.filter(({ severity }) => severity === "error");
    const warnings = issues.filter(({ severity }) => severity === "warning");
    const coverage = issues.filter(({ category }) => category === "coverage");
    const hours = issues.filter(({ category }) => category === "hours");
    const availability = issues.filter(({ category }) => category === "availability");

    return `
        <section class="schedule-status">
            <div class="summary-heading">
                <p class="section-label">
                    Validation
                </p>

                <div class="status-heading-row">
                    <h2>
                        Schedule status
                    </h2>

                    <div class="status-counts">
                        <span class="status-count status-count--error">
                            ${errors.length} errors
                        </span>

                        <span class="status-count status-count--warning">
                            ${warnings.length} warnings
                        </span>
                    </div>
                </div>
            </div>

            ${issues.length === 0
                ? `
                    <div class="status-clear">
                        No schedule issues found.
                    </div>
                `
                : `
                    <details class="status-details">
                        <summary>
                            Show validation details
                        </summary>

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
                    </details>
                `}
        </section>
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
                ${shifts.length === 0
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

function renderShiftEditor(
    state: PlannerState,
    editorMode: PlannerEditorMode,
): string {
    const existingShift = editorMode.type === "edit"
        ? state.shifts.find(({ id }) => id === editorMode.shiftId)
        : undefined;
    if (editorMode.type === "edit" && !existingShift) return "";

    const date = existingShift?.date
        ?? (editorMode.type === "add" ? editorMode.date : "");
    const employeeId = existingShift?.employeeId ?? state.employees[0]?.id ?? "";
    const start = existingShift?.start ?? state.storeHours.open;
    const end = existingShift?.end ?? state.storeHours.close;
    const isEditing = editorMode.type === "edit";

    return `
        <section class="shift-editor">
            <div class="shift-editor-heading">
                <div>
                    <p class="section-label">
                        ${isEditing ? "Edit shift" : "Add shift"}
                    </p>

                    <h2>
                        ${formatDateLabel(date)}
                    </h2>
                </div>
            </div>

            <form id="shift-form" class="shift-form">
                <label class="form-field">
                    <span>Employee</span>
                    <select id="shift-employee" name="employeeId" required>
                        ${state.employees.map((employee) => `
                            <option
                                value="${employee.id}"
                                ${employee.id === employeeId ? "selected" : ""}
                            >
                                ${employeeFullName(employee)}
                            </option>
                        `).join("")}
                    </select>
                </label>

                <label class="form-field">
                    <span>Start</span>
                    <input name="start" type="time" value="${start}" required />
                </label>

                <label class="form-field">
                    <span>End</span>
                    <input name="end" type="time" value="${end}" required />
                </label>

                <div class="shift-form-actions">
                    ${isEditing ? `
                        <button
                            class="danger-button"
                            data-action="delete-shift"
                            type="button"
                        >
                            Delete
                        </button>
                    ` : ""}

                    <button
                        class="secondary-button"
                        data-action="cancel-shift"
                        type="button"
                    >
                        Cancel
                    </button>

                    <button
                        class="primary-button"
                        id="save-shift-button"
                        type="submit"
                    >
                        ${isEditing ? "Save changes" : "Add shift"}
                    </button>
                </div>
            </form>

            <div
                id="shift-validation"
                class="shift-validation"
                aria-live="polite"
            ></div>
        </section>
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

function formatDateLabel(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(new Date(year, month - 1, day));
}

function formatShortDate(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
    }).format(new Date(year, month - 1, day));
}
