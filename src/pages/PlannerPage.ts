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
                            ${renderCalendarDays(state)}
                        </div>
                    </div>
                </div>

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

                render();
            },
        );
    }

    render();
}

function renderCalendarDays(
    state: PlannerState,
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
            () =>
                '<div class="calendar-day calendar-day--placeholder"></div>',
        ).join("");

    const days =
        openDates
            .map((day) =>
                renderCalendarDay(
                    state,
                    day,
                ),
            )
            .join("");

    return placeholders + days;
}

function renderCalendarDay(
    state: PlannerState,
    day: number,
): string {
    const dateKey =
        createDateKey(
            state.selectedYear,
            state.selectedMonth,
            day,
        );

    const shifts =
        state.shifts.filter(
            (shift) =>
                shift.date ===
                dateKey,
        );

    return `
        <article
            class="calendar-day"
            data-date="${dateKey}"
        >
            <div class="calendar-day-header">
                <strong>${day}</strong>
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
                                (shift) => `
                                    <div class="calendar-shift">
                                        ${shift.employeeId.toUpperCase()}
                                        ${shift.start}–${shift.end}
                                    </div>
                                `,
                            )
                            .join("")
                }
            </div>
        </article>
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