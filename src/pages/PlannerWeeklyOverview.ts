import {
    formatDifferenceMinutes,
    formatMinutes,
} from "../services/hoursService";
import type {
    EmployeeWeekSummary,
    PlannerState,
} from "../types/planning";

export function renderPlannerWeeklyOverview(
    state: PlannerState,
    summaries: EmployeeWeekSummary[],
): string {
    const weekStarts = [
        ...new Set(summaries.map(({ weekStart }) => weekStart)),
    ];

    return `
        <section class="weekly-hours planner-overview">
            <div class="summary-heading">
                <p class="section-label">
                    Contract hours
                </p>

                <h2>
                    Weekly overview
                </h2>
            </div>

            <div class="week-list">
                ${weekStarts.map(
                    (weekStart) => renderWeek(state, summaries, weekStart),
                ).join("")}
            </div>
        </section>
    `;
}

function renderWeek(
    state: PlannerState,
    summaries: EmployeeWeekSummary[],
    weekStart: string,
): string {
    const weekSummaries = summaries.filter(
        (summary) => summary.weekStart === weekStart,
    );
    const firstSummary = weekSummaries[0];
    if (!firstSummary) return "";

    return `
        <article class="week-card">
            <div class="week-card-header">
                <strong>
                    ${formatShortDate(firstSummary.weekStart)}
                    –
                    ${formatShortDate(firstSummary.weekEnd)}
                </strong>

                ${firstSummary.partialMonthWeek ? `
                    <span class="partial-week-label">
                        Partial month week
                    </span>
                ` : ""}
            </div>

            <div class="week-employees">
                ${state.employees.map((employee) => {
                    const summary = weekSummaries.find(
                        ({ employeeId }) => employeeId === employee.id,
                    );
                    if (!summary) return "";

                    return `
                        <div class="week-employee">
                            <span>${employee.name}</span>
                            <strong>
                                ${formatMinutes(summary.scheduledMinutes)}
                                / ${formatMinutes(summary.targetMinutes)}
                            </strong>
                            <small>
                                ${employee.availability.days.length === 1
                                    ? `${summary.daysWorked} day${summary.daysWorked === 1 ? "" : "s"}`
                                    : firstSummary.partialMonthWeek
                                        ? "partial"
                                        : formatDifferenceMinutes(summary.differenceMinutes)}
                            </small>
                        </div>
                    `;
                }).join("")}
            </div>
        </article>
    `;
}

function formatShortDate(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
    }).format(new Date(year, month - 1, day));
}
