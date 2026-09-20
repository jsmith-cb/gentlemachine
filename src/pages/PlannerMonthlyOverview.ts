import { formatMinutes } from "../services/hoursService";
import type {
    Employee,
    EmployeeMonthSummary,
    PlannerState,
} from "../types/planning";

export function renderPlannerMonthlyOverview(
    state: PlannerState,
    summaries: EmployeeMonthSummary[],
): string {
    return `
        <section class="employee-summary planner-overview">
            <div class="summary-heading">
                <p class="section-label">
                    Employees
                </p>

                <h2>
                    Monthly overview
                </h2>
            </div>

            <div class="summary-list">
                ${state.employees.map((employee) => {
                    const summary = summaries.find(
                        ({ employeeId }) => employeeId === employee.id,
                    );
                    return renderEmployeeSummary(employee, summary);
                }).join("")}
            </div>
        </section>
    `;
}

function renderEmployeeSummary(
    employee: Employee,
    summary: EmployeeMonthSummary | undefined,
): string {
    if (!summary) return "";

    return `
        <article class="summary-row">
            <div class="employee-name">
                <strong>${employee.name}</strong>
                <span>${formatEmployeeAvailability(employee)}</span>
            </div>

            <div class="summary-stat">
                <strong>${formatMinutes(employee.weeklyTargetMinutes)}</strong>
                <span>weekly target</span>
            </div>

            <div class="summary-stat">
                <strong>${formatMinutes(summary.scheduledMinutes)}</strong>
                <span>month scheduled</span>
            </div>

            <div class="summary-stat">
                <strong>${summary.saturdaysWorked}</strong>
                <span>Saturdays</span>
            </div>
        </article>
    `;
}

function formatEmployeeAvailability(employee: Employee): string {
    const { days, earliestStart, latestEnd } = employee.availability;

    if (days.length === 1 && days[0] === 6) return "Saturday only";
    if (
        days.length === 5
        && !days.includes(6)
        && earliestStart
        && latestEnd
    ) {
        return `Mon–Fri · ${earliestStart}–${latestEnd}`;
    }
    if (earliestStart && latestEnd) return `${earliestStart}–${latestEnd}`;
    return `Max ${employee.maxDaysPerWeek} days/week`;
}
