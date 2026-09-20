import {
    createInitialPlannerState,
} from "../state/plannerState";

import {
    getEmployeeMonthSummaries,
    formatMinutes,
    isDateInMonth,
} from "../services/hoursService";

import { getStoredShifts, getStoredEmployees, setStoredEmployees } from "../services/storageService";

import type { PlannerState } from "../types/planning";

let state: PlannerState;
let selectedEmployeeId: string | null = null;

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderEmployeePlanningPage(
    container: HTMLElement,
): void {
    const storedShifts = getStoredShifts();
    const storedEmployees = getStoredEmployees();

    state = createInitialPlannerState(storedShifts, storedEmployees);

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

        const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const availability = selectedEmployee.availability;
        const targetHours = (selectedEmployee.weeklyTargetMinutes / 60).toFixed(1);

        container.innerHTML = `
            <section class="planner">
                <div class="planner-intro">
                    <div>
                        <p class="section-label">
                            Employee Planning
                        </p>

                        <h2 class="employee-name">
                            ${escapeHtml(selectedEmployee.name)}
                        </h2>
                    </div>
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
                                        ${escapeHtml(emp.name)}
                                    </option>
                                `,
                            )
                            .join("")}
                    </select>
                </div>

                <div class="planner-meta" style="margin-top: 3rem;">
                    <p class="closed-note">${state.selectedYear}-${String(state.selectedMonth).padStart(2, "0")} Overview</p>
                </div>

                <form class="employee-form" id="employee-form" style="margin-top: 2rem;">
                    <h3>Employee Settings</h3>

                    <div class="form-group">
                        <label for="emp-name">Name</label>
                        <input type="text" id="emp-name" name="name" value="${escapeHtml(selectedEmployee.name)}" required />
                    </div>

                    <div class="form-group">
                        <label for="emp-target-hours">Weekly Target Hours</label>
                        <input type="number" id="emp-target-hours" name="targetHours" value="${targetHours}" step="0.5" min="0" max="60" required />
                    </div>

                    <div class="form-group">
                        <label for="emp-max-days">Max Days Per Week</label>
                        <select id="emp-max-days" name="maxDays" required>
                            ${[1, 2, 3, 4, 5, 6, 7].map((d) =>
                                `<option value="${d}" ${d === selectedEmployee.maxDaysPerWeek ? "selected" : ""}>${d}</option>`
                            ).join("")}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Available Days</label>
                        <div class="day-checkboxes">
                            ${dayLabels.map((label, i) => {
                                const day = i + 1;
                                const checked = availability.days.includes(day);
                                return `
                                    <label class="day-checkbox">
                                        <input type="checkbox" name="days" value="${day}" ${checked ? "checked" : ""} />
                                        ${label}
                                    </label>
                                `;
                            }).join("")}
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="emp-earliest">Earliest Start</label>
                        <input type="time" id="emp-earliest" name="earliest" value="${availability.earliestStart ?? ""}" />
                    </div>

                    <div class="form-group">
                        <label for="emp-latest">Latest End</label>
                        <input type="time" id="emp-latest" name="latest" value="${availability.latestEnd ?? ""}" />
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="primary-button">Save</button>
                        <span id="save-status"></span>
                    </div>
                </form>
            </section>
        `;

        const selector = container.querySelector<HTMLSelectElement>("#employee-select");
        selector?.addEventListener("change", () => {
            selectedEmployeeId = selector.value || null;
            render();
        });

        const form = container.querySelector<HTMLFormElement>("#employee-form");
        form?.addEventListener("submit", (event) => {
            event.preventDefault();

            const nameInput = container.querySelector<HTMLInputElement>('#emp-name');
            const targetInput = container.querySelector<HTMLInputElement>('#emp-target-hours');
            const maxDaysSelect = container.querySelector<HTMLSelectElement>('#emp-max-days');
            const earliestInput = container.querySelector<HTMLInputElement>('#emp-earliest');
            const latestInput = container.querySelector<HTMLInputElement>('#emp-latest');

            const name = nameInput?.value ?? "";
            const targetHoursNum = parseFloat(targetInput?.value ?? "0");
            const maxDays = parseInt(maxDaysSelect?.value ?? "5", 10);

            const dayCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="days"]:checked');
            const days = Array.from(dayCheckboxes).map(cb => parseInt(cb.value, 10));

            const earliest = earliestInput?.value || undefined;
            const latest = latestInput?.value || undefined;

            const updatedEmployee = {
                ...selectedEmployee,
                name,
                weeklyTargetMinutes: Math.round(targetHoursNum * 60),
                maxDaysPerWeek: maxDays,
                availability: {
                    days,
                    earliestStart: earliest,
                    latestEnd: latest,
                },
            };

            state.employees = state.employees.map((emp) =>
                emp.id === selectedEmployeeId ? updatedEmployee : emp,
            );

            setStoredEmployees(state.employees);

            render();

            const saveStatus = container.querySelector("#save-status");
            if (saveStatus) {
                saveStatus.textContent = "Saved!";
                setTimeout(() => {
                    saveStatus.textContent = "";
                }, 2000);
            }
        });
    }

    render();
}
