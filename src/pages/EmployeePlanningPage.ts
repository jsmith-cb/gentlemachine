import {
    createInitialPlannerState,
} from "../state/plannerState";

import {
    getEmployeeMonthSummaries,
    formatMinutes,
    isDateInMonth,
} from "../services/hoursService";

import { getStoredShifts } from "../services/storageService";

import type { PlannerState } from "../types/planning";

let state: PlannerState;
let selectedEmployeeId: string | null = null;

export function renderEmployeePlanningPage(
    container: HTMLElement,
): void {
    const storedShifts = getStoredShifts();

    state = createInitialPlannerState(storedShifts);

    // Default to the first employee if available
    if (state.employees.length > 0) {
        selectedEmployeeId = state.employees[0].id;
    }

    function render(): void {
        const monthSummaries = getEmployeeMonthSummaries(state);
        const selectedEmployee = state.employees.find(
            (e) => e.id === selectedEmployeeId,
        );

        if (!selectedEmployee) {
            container.innerHTML = `
                <h1 class="page-heading">
                    Employee Planning
                </h1>

                <p class="page-placeholder">
                    Please select an employee to view their planning details.
                </p>
            `;
            return;
        }

        const summary = monthSummaries.find(
            ({ employeeId }) => employeeId === selectedEmployee.id,
        );

        const shiftCount = state.shifts.filter(
            (shift) =>
                shift.employeeId ===
                    selectedEmployeeId &&
                isDateInMonth(
                    shift.date,
                    state.selectedYear,
                    state.selectedMonth,
                ),
        ).length;

        container.innerHTML = `
            <section class="planner">
                <div class="planner-intro">
                    <div>
                        <p class="section-label">
                            Employee Planning
                        </p>

                        <h2 class="employee-name">
                            ${selectedEmployee.name}
                        </h2>
                    </div>

                    <div class="month-navigation">
                        <p class="store-hours">
                            Weekly target: ${formatMinutes(selectedEmployee.weeklyTargetMinutes)}
                        </p>
                    </div>
                </div>

                <div class="planner-meta">
                    <p class="closed-note">
                        ${state.selectedYear}-${String(state.selectedMonth).padStart(2, "0")} Overview
                    </p>
                </div>

                <div class="summary-list" style="margin-top: 2rem;">
                    <div class="summary-item">
                        <span class="summary-label">
                            Shifts this month:
                        </span>
                        <span class="summary-value">
                            ${shiftCount}
                        </span>
                    </div>

                    <div class="summary-item">
                        <span class="summary-label">
                            Total scheduled paid hours:
                        </span>
                        <span class="summary-value">
                            ${formatMinutes(summary?.scheduledMinutes ?? 0)}
                        </span>
                    </div>
                </div>

                <div class="employee-selector" style="margin-top: 3rem;">
                    <label for="employee-select">
                        Select Employee:
                    </label>

                    <select
                        id="employee-select"
                        style="padding: 0.5rem; font-size: 1rem;"
                    >
                        ${state.employees
                            .map(
                                (emp) => `
                                    <option
                                        value="${emp.id}"
                                        ${emp.id === selectedEmployeeId ? "selected" : ""}
                                    >
                                        ${emp.name}
                                    </option>
                                `,
                            )
                            .join("")}
                    </select>
                </div>
            </section>
        `;

        const selector = container.querySelector<HTMLSelectElement>(
            "#employee-select",
        );

        selector?.addEventListener(
            "change",
            () => {
                selectedEmployeeId = selector.value || null;
                render();
            },
        );
    }

    render();
}
