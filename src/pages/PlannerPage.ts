import {
    formatMinutes,
    getEmployeeMonthSummaries,
} from "../services/hoursService";

import {
    validateShift,
} from "../services/validationService";

import {
    createInitialPlannerState,
} from "../state/plannerState";

import type {
    Employee,
    EmployeeMonthSummary,
    PlannerState,
    Shift,
    ValidationIssue,
} from "../types/planning";

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
] as const;

const OPEN_DAY_LABELS = [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
] as const;

type EditorMode =
    | {
        type: "add";
        date: string;
    }
    | {
        type: "edit";
        shiftId: string;
    };

export function renderPlannerPage(
    container: HTMLElement,
): void {
    let state =
        createInitialPlannerState();

    let editorMode:
        | EditorMode
        | null = null;

    function render(): void {
        const summaries =
            getEmployeeMonthSummaries(
                state,
            );

        container.innerHTML = `
            <section class="planner">
                <div class="planner-intro">
                    <div>
                        <p class="section-label">
                            Schedule
                        </p>

                        <h2>
                            ${MONTH_NAMES[state.selectedMonth - 1]}
                            ${state.selectedYear}
                        </h2>
                    </div>

                    <div class="month-navigation">
                        <button
                            class="month-button"
                            data-action="previous-month"
                            type="button"
                            aria-label="Previous month"
                        >
                            ←
                        </button>

                        <button
                            class="month-button month-button--today"
                            data-action="today"
                            type="button"
                        >
                            Today
                        </button>

                        <button
                            class="month-button"
                            data-action="next-month"
                            type="button"
                            aria-label="Next month"
                        >
                            →
                        </button>
                    </div>
                </div>

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
                            ${renderCalendarDays(
                                state,
                                editorMode,
                            )}
                        </div>
                    </div>
                </div>

                ${
                    editorMode
                        ? renderShiftEditor(
                            state,
                            editorMode,
                        )
                        : ""
                }

                <section class="employee-summary">
                    <div class="summary-heading">
                        <p class="section-label">
                            Employees
                        </p>

                        <h2>
                            Monthly overview
                        </h2>
                    </div>

                    <div class="summary-list">
                        ${state.employees
                            .map((employee) => {
                                const summary =
                                    summaries.find(
                                        ({ employeeId }) =>
                                            employeeId ===
                                            employee.id,
                                    );

                                return renderEmployeeSummary(
                                    employee,
                                    summary,
                                );
                            })
                            .join("")}
                    </div>
                </section>
            </section>
        `;

        attachNavigationListeners();
        attachCalendarListeners();
        attachShiftEditorListeners();
    }

    function attachNavigationListeners(): void {
        const previousButton =
            container.querySelector<HTMLButtonElement>(
                '[data-action="previous-month"]',
            );

        const nextButton =
            container.querySelector<HTMLButtonElement>(
                '[data-action="next-month"]',
            );

        const todayButton =
            container.querySelector<HTMLButtonElement>(
                '[data-action="today"]',
            );

        previousButton?.addEventListener(
            "click",
            () => {
                state =
                    changeMonth(
                        state,
                        -1,
                    );

                editorMode = null;

                render();
            },
        );

        nextButton?.addEventListener(
            "click",
            () => {
                state =
                    changeMonth(
                        state,
                        1,
                    );

                editorMode = null;

                render();
            },
        );

        todayButton?.addEventListener(
            "click",
            () => {
                const now =
                    new Date();

                state = {
                    ...state,
                    selectedYear:
                        now.getFullYear(),
                    selectedMonth:
                        now.getMonth() + 1,
                };

                editorMode = null;

                render();
            },
        );
    }

    function attachCalendarListeners(): void {
        const addButtons =
            container.querySelectorAll<HTMLButtonElement>(
                "[data-add-date]",
            );

        for (
            const button
            of addButtons
        ) {
            button.addEventListener(
                "click",
                () => {
                    const date =
                        button.dataset.addDate;

                    if (!date) {
                        return;
                    }

                    editorMode = {
                        type: "add",
                        date,
                    };

                    render();
                    focusEmployeeField();
                },
            );
        }

        const shiftButtons =
            container.querySelectorAll<HTMLButtonElement>(
                "[data-edit-shift]",
            );

        for (
            const button
            of shiftButtons
        ) {
            button.addEventListener(
                "click",
                () => {
                    const shiftId =
                        button.dataset.editShift;

                    if (!shiftId) {
                        return;
                    }

                    editorMode = {
                        type: "edit",
                        shiftId,
                    };

                    render();
                    focusEmployeeField();
                },
            );
        }
    }

    function attachShiftEditorListeners(): void {
        const form =
            container.querySelector<HTMLFormElement>(
                "#shift-form",
            );

        const cancelButton =
            container.querySelector<HTMLButtonElement>(
                '[data-action="cancel-shift"]',
            );

        const deleteButton =
            container.querySelector<HTMLButtonElement>(
                '[data-action="delete-shift"]',
            );

        cancelButton?.addEventListener(
            "click",
            () => {
                editorMode = null;

                render();
            },
        );

        deleteButton?.addEventListener(
            "click",
            () => {
                if (
                    !editorMode ||
                    editorMode.type !==
                        "edit"
                ) {
                    return;
                }

                state = {
                    ...state,
                    shifts:
                        state.shifts.filter(
                            ({ id }) =>
                                id !==
                                editorMode.shiftId,
                        ),
                };

                editorMode = null;

                render();
            },
        );

        if (!form) {
            return;
        }

        const updateValidation =
            (): ValidationIssue[] => {
                const draft =
                    createShiftFromForm(
                        form,
                        editorMode,
                        state,
                    );

                if (!draft) {
                    renderEditorIssues(
                        container,
                        [],
                    );

                    return [];
                }

                const issues =
                    validateShift(
                        state,
                        draft,
                    );

                renderEditorIssues(
                    container,
                    issues,
                );

                return issues;
            };

        const fields =
            form.querySelectorAll<
                HTMLInputElement |
                HTMLSelectElement
            >(
                "input, select",
            );

        for (
            const field
            of fields
        ) {
            field.addEventListener(
                "input",
                updateValidation,
            );

            field.addEventListener(
                "change",
                updateValidation,
            );
        }

        updateValidation();

        form.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();

                const shift =
                    createShiftFromForm(
                        form,
                        editorMode,
                        state,
                    );

                if (!shift) {
                    return;
                }

                const issues =
                    validateShift(
                        state,
                        shift,
                    );

                renderEditorIssues(
                    container,
                    issues,
                );

                const hasErrors =
                    issues.some(
                        ({ severity }) =>
                            severity ===
                            "error",
                    );

                if (hasErrors) {
                    return;
                }

                if (
                    editorMode?.type ===
                    "edit"
                ) {
                    state = {
                        ...state,
                        shifts:
                            state.shifts.map(
                                (existingShift) =>
                                    existingShift.id ===
                                    shift.id
                                        ? shift
                                        : existingShift,
                            ),
                    };
                } else {
                    state = {
                        ...state,
                        shifts: [
                            ...state.shifts,
                            shift,
                        ],
                    };
                }

                editorMode = null;

                render();
            },
        );
    }

    function focusEmployeeField(): void {
        const employeeSelect =
            container.querySelector<HTMLSelectElement>(
                "#shift-employee",
            );

        employeeSelect?.focus();
    }

    render();
}

function renderCalendarDays(
    state: PlannerState,
    editorMode:
        | EditorMode
        | null,
): string {
    const daysInMonth =
        new Date(
            state.selectedYear,
            state.selectedMonth,
            0,
        ).getDate();

    const openDates: number[] = [];

    for (
        let day = 1;
        day <= daysInMonth;
        day += 1
    ) {
        const date =
            new Date(
                state.selectedYear,
                state.selectedMonth - 1,
                day,
            );

        if (
            date.getDay() !== 0
        ) {
            openDates.push(
                day,
            );
        }
    }

    if (
        openDates.length === 0
    ) {
        return "";
    }

    const firstOpenDay =
        openDates[0];

    const firstDate =
        new Date(
            state.selectedYear,
            state.selectedMonth - 1,
            firstOpenDay,
        );

    const firstDayIndex =
        firstDate.getDay() - 1;

    const placeholders =
        Array.from(
            {
                length:
                    Math.max(
                        firstDayIndex,
                        0,
                    ),
            },
            () => `
                <div
                    class="calendar-day calendar-day--placeholder"
                    aria-hidden="true"
                ></div>
            `,
        ).join("");

    const days =
        openDates
            .map(
                (day) =>
                    renderCalendarDay(
                        state,
                        day,
                        editorMode,
                    ),
            )
            .join("");

    return (
        placeholders +
        days
    );
}

function renderCalendarDay(
    state: PlannerState,
    day: number,
    editorMode:
        | EditorMode
        | null,
): string {
    const dateKey =
        createDateKey(
            state.selectedYear,
            state.selectedMonth,
            day,
        );

    const shifts =
        state.shifts
            .filter(
                (shift) =>
                    shift.date ===
                    dateKey,
            )
            .sort(
                (left, right) =>
                    left.start.localeCompare(
                        right.start,
                    ),
            );

    const selectedDate =
        getEditorDate(
            state,
            editorMode,
        );

    const selectedClass =
        selectedDate === dateKey
            ? " calendar-day--selected"
            : "";

    return `
        <article
            class="calendar-day${selectedClass}"
        >
            <button
                class="calendar-day-add"
                data-add-date="${dateKey}"
                type="button"
                aria-label="Add shift for ${formatDateLabel(dateKey)}"
            >
                <span class="calendar-day-number">
                    ${day}
                </span>

                <span class="add-shift-label">
                    + Shift
                </span>
            </button>

            <div class="calendar-day-content">
                ${
                    shifts.length === 0
                        ? `
                            <span class="no-shifts">
                                No shifts
                            </span>
                        `
                        : shifts
                            .map(
                                (shift) =>
                                    renderShift(
                                        state,
                                        shift,
                                        editorMode,
                                    ),
                            )
                            .join("")
                }
            </div>
        </article>
    `;
}

function renderShift(
    state: PlannerState,
    shift: Shift,
    editorMode:
        | EditorMode
        | null,
): string {
    const employee =
        state.employees.find(
            ({ id }) =>
                id ===
                shift.employeeId,
        );

    const selectedClass =
        editorMode?.type ===
            "edit" &&
        editorMode.shiftId ===
            shift.id
            ? " calendar-shift--selected"
            : "";

    return `
        <button
            class="calendar-shift${selectedClass}"
            data-edit-shift="${shift.id}"
            type="button"
            aria-label="Edit ${employee?.name ?? shift.employeeId} shift"
        >
            <strong>
                ${employee?.name ?? shift.employeeId}
            </strong>

            <span>
                ${shift.start}–${shift.end}
            </span>
        </button>
    `;
}

function renderShiftEditor(
    state: PlannerState,
    editorMode: EditorMode,
): string {
    const existingShift =
        editorMode.type ===
            "edit"
            ? state.shifts.find(
                ({ id }) =>
                    id ===
                    editorMode.shiftId,
            )
            : undefined;

    if (
        editorMode.type ===
            "edit" &&
        !existingShift
    ) {
        return "";
    }

    const date =
        existingShift?.date ??
        (
            editorMode.type ===
                "add"
                ? editorMode.date
                : ""
        );

    const employeeId =
        existingShift?.employeeId ??
        state.employees[0]?.id ??
        "";

    const start =
        existingShift?.start ??
        state.storeHours.open;

    const end =
        existingShift?.end ??
        state.storeHours.close;

    const isEditing =
        editorMode.type ===
        "edit";

    return `
        <section class="shift-editor">
            <div class="shift-editor-heading">
                <div>
                    <p class="section-label">
                        ${
                            isEditing
                                ? "Edit shift"
                                : "Add shift"
                        }
                    </p>

                    <h2>
                        ${formatDateLabel(date)}
                    </h2>
                </div>
            </div>

            <form
                id="shift-form"
                class="shift-form"
            >
                <label class="form-field">
                    <span>
                        Employee
                    </span>

                    <select
                        id="shift-employee"
                        name="employeeId"
                        required
                    >
                        ${state.employees
                            .map(
                                (employee) => `
                                    <option
                                        value="${employee.id}"
                                        ${
                                            employee.id ===
                                            employeeId
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        ${employee.name}
                                    </option>
                                `,
                            )
                            .join("")}
                    </select>
                </label>

                <label class="form-field">
                    <span>
                        Start
                    </span>

                    <input
                        name="start"
                        type="time"
                        value="${start}"
                        required
                    />
                </label>

                <label class="form-field">
                    <span>
                        End
                    </span>

                    <input
                        name="end"
                        type="time"
                        value="${end}"
                        required
                    />
                </label>

                <div class="shift-form-actions">
                    ${
                        isEditing
                            ? `
                                <button
                                    class="danger-button"
                                    data-action="delete-shift"
                                    type="button"
                                >
                                    Delete
                                </button>
                            `
                            : ""
                    }

                    <button
                        class="secondary-button"
                        data-action="cancel-shift"
                        type="button"
                    >
                        Cancel
                    </button>

                    <button
                        class="primary-button"
                        type="submit"
                    >
                        ${
                            isEditing
                                ? "Save changes"
                                : "Add shift"
                        }
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

function createShiftFromForm(
    form: HTMLFormElement,
    editorMode:
        | EditorMode
        | null,
    state: PlannerState,
): Shift | null {
    if (!editorMode) {
        return null;
    }

    const formData =
        new FormData(
            form,
        );

    const employeeId =
        String(
            formData.get(
                "employeeId",
            ) ?? "",
        );

    const start =
        String(
            formData.get(
                "start",
            ) ?? "",
        );

    const end =
        String(
            formData.get(
                "end",
            ) ?? "",
        );

    if (
        !employeeId ||
        !start ||
        !end
    ) {
        return null;
    }

    if (
        editorMode.type ===
        "edit"
    ) {
        const existingShift =
            state.shifts.find(
                ({ id }) =>
                    id ===
                    editorMode.shiftId,
            );

        if (!existingShift) {
            return null;
        }

        return {
            ...existingShift,
            employeeId,
            start,
            end,
        };
    }

    return {
        id:
            createShiftId(),
        employeeId,
        date:
            editorMode.date,
        start,
        end,
    };
}

function renderEditorIssues(
    container: HTMLElement,
    issues: ValidationIssue[],
): void {
    const validationContainer =
        container.querySelector<HTMLElement>(
            "#shift-validation",
        );

    if (
        !validationContainer
    ) {
        return;
    }

    if (
        issues.length === 0
    ) {
        validationContainer.innerHTML =
            "";

        validationContainer.hidden =
            true;

        return;
    }

    validationContainer.hidden =
        false;

    validationContainer.innerHTML =
        issues
            .map(
                (issue) => `
                    <p
                        class="validation-message validation-message--${issue.severity}"
                    >
                        ${
                            issue.severity ===
                            "error"
                                ? "Error:"
                                : "Warning:"
                        }

                        ${issue.message}
                    </p>
                `,
            )
            .join("");
}

function renderEmployeeSummary(
    employee: Employee,
    summary:
        | EmployeeMonthSummary
        | undefined,
): string {
    if (!summary) {
        return "";
    }

    return `
        <article class="summary-row">
            <div class="employee-name">
                <strong>
                    ${employee.name}
                </strong>

                <span>
                    ${
                        employee.saturdayOnly
                            ? "Saturday only"
                            : `Max ${employee.maxDaysPerWeek} days/week`
                    }
                </span>
            </div>

            <div class="summary-stat">
                <strong>
                    ${formatMinutes(employee.weeklyTargetMinutes)}
                </strong>

                <span>
                    weekly target
                </span>
            </div>

            <div class="summary-stat">
                <strong>
                    ${formatMinutes(summary.scheduledMinutes)}
                </strong>

                <span>
                    month scheduled
                </span>
            </div>

            <div class="summary-stat">
                <strong>
                    ${summary.saturdaysWorked}
                </strong>

                <span>
                    Saturdays
                </span>
            </div>
        </article>
    `;
}

function getEditorDate(
    state: PlannerState,
    editorMode:
        | EditorMode
        | null,
): string | null {
    if (!editorMode) {
        return null;
    }

    if (
        editorMode.type ===
        "add"
    ) {
        return editorMode.date;
    }

    return (
        state.shifts.find(
            ({ id }) =>
                id ===
                editorMode.shiftId,
        )?.date ??
        null
    );
}

function changeMonth(
    state: PlannerState,
    amount: number,
): PlannerState {
    const date =
        new Date(
            state.selectedYear,
            state.selectedMonth - 1 +
                amount,
            1,
        );

    return {
        ...state,
        selectedYear:
            date.getFullYear(),
        selectedMonth:
            date.getMonth() + 1,
    };
}

function createDateKey(
    year: number,
    month: number,
    day: number,
): string {
    return [
        year,
        String(
            month,
        ).padStart(
            2,
            "0",
        ),
        String(
            day,
        ).padStart(
            2,
            "0",
        ),
    ].join("-");
}

function formatDateLabel(
    date: string,
): string {
    const [
        year,
        month,
        day,
    ] =
        date
            .split("-")
            .map(
                Number,
            );

    const value =
        new Date(
            year,
            month - 1,
            day,
        );

    return new Intl.DateTimeFormat(
        "en",
        {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        },
    ).format(
        value,
    );
}

function createShiftId(): string {
    if (
        typeof crypto !==
            "undefined" &&
        "randomUUID" in
            crypto
    ) {
        return crypto.randomUUID();
    }

    return [
        "shift",
        Date.now(),
        Math.random()
            .toString(
                16,
            )
            .slice(
                2,
            ),
    ].join("-");
}