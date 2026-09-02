import {
    formatMinutes,
    getEmployeeMonthSummaries,
} from "../services/hoursService";

import {
    createInitialPlannerState,
} from "../state/plannerState";

import type {
    Employee,
    EmployeeMonthSummary,
    PlannerState,
    Shift,
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

export function renderPlannerPage(
    container: HTMLElement,
): void {
    let state =
        createInitialPlannerState();

    let selectedDate: string | null =
        null;

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
                                selectedDate,
                            )}
                        </div>
                    </div>
                </div>

                ${
                    selectedDate
                        ? renderShiftForm(
                            state,
                            selectedDate,
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
        attachShiftFormListeners();
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

                selectedDate = null;

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

                selectedDate = null;

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

                selectedDate = null;

                render();
            },
        );
    }

    function attachCalendarListeners(): void {
        const dayButtons =
            container.querySelectorAll<HTMLButtonElement>(
                "[data-date]",
            );

        for (const button of dayButtons) {
            button.addEventListener(
                "click",
                () => {
                    const date =
                        button.dataset.date;

                    if (!date) {
                        return;
                    }

                    selectedDate = date;

                    render();

                    const employeeSelect =
                        container.querySelector<HTMLSelectElement>(
                            "#shift-employee",
                        );

                    employeeSelect?.focus();
                },
            );
        }
    }

    function attachShiftFormListeners(): void {
        const form =
            container.querySelector<HTMLFormElement>(
                "#shift-form",
            );

        const cancelButton =
            container.querySelector<HTMLButtonElement>(
                '[data-action="cancel-shift"]',
            );

        cancelButton?.addEventListener(
            "click",
            () => {
                selectedDate = null;

                render();
            },
        );

        form?.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();

                if (!selectedDate) {
                    return;
                }

                const formData =
                    new FormData(form);

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
                    return;
                }

                const shift: Shift = {
                    id: createShiftId(),
                    employeeId,
                    date: selectedDate,
                    start,
                    end,
                };

                state = {
                    ...state,
                    shifts: [
                        ...state.shifts,
                        shift,
                    ],
                };

                selectedDate = null;

                render();
            },
        );
    }

    render();
}

function renderCalendarDays(
    state: PlannerState,
    selectedDate: string | null,
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
            openDates.push(day);
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
            .map((day) =>
                renderCalendarDay(
                    state,
                    day,
                    selectedDate,
                ),
            )
            .join("");

    return placeholders + days;
}

function renderCalendarDay(
    state: PlannerState,
    day: number,
    selectedDate: string | null,
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

    const selectedClass =
        selectedDate === dateKey
            ? " calendar-day-button--selected"
            : "";

    return `
        <article class="calendar-day">
            <button
                class="calendar-day-button${selectedClass}"
                data-date="${dateKey}"
                type="button"
                aria-label="Add shift for ${formatDateLabel(dateKey)}"
            >
                <div class="calendar-day-header">
                    <strong>${day}</strong>

                    <span class="add-shift-label">
                        + Shift
                    </span>
                </div>

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
                                        ),
                                )
                                .join("")
                    }
                </div>
            </button>
        </article>
    `;
}

function renderShift(
    state: PlannerState,
    shift: Shift,
): string {
    const employee =
        state.employees.find(
            ({ id }) =>
                id ===
                shift.employeeId,
        );

    return `
        <div class="calendar-shift">
            <strong>
                ${employee?.name ?? shift.employeeId}
            </strong>

            <span>
                ${shift.start}–${shift.end}
            </span>
        </div>
    `;
}

function renderShiftForm(
    state: PlannerState,
    date: string,
): string {
    return `
        <section class="shift-editor">
            <div class="shift-editor-heading">
                <div>
                    <p class="section-label">
                        Add shift
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
                        value="${state.storeHours.open}"
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
                        value="${state.storeHours.close}"
                        required
                    />
                </label>

                <div class="shift-form-actions">
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
                        Add shift
                    </button>
                </div>
            </form>
        </section>
    `;
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

function changeMonth(
    state: PlannerState,
    amount: number,
): PlannerState {
    const date =
        new Date(
            state.selectedYear,
            state.selectedMonth - 1 + amount,
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
        String(month).padStart(
            2,
            "0",
        ),
        String(day).padStart(
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
    ] = date
        .split("-")
        .map(Number);

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
    ).format(value);
}

function createShiftId(): string {
    if (
        typeof crypto !== "undefined" &&
        "randomUUID" in crypto
    ) {
        return crypto.randomUUID();
    }

    return [
        "shift",
        Date.now(),
        Math.random()
            .toString(16)
            .slice(2),
    ].join("-");
}