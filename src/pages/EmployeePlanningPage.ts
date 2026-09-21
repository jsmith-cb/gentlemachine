import {
    createInitialPlannerState,
} from "../state/plannerState";

import {
    getEmployeeMonthSummaries,
    getMonthlyTargetMinutes,
    formatMinutes,
} from "../services/hoursService";
import { employeeFullName, employeeSelectOptions } from "../services/employeeIdentity";

import { getStoredShifts, getStoredEmployees, setStoredEmployees, setStoredShifts } from "../services/storageService";

import type { PlannerState } from "../types/planning";

let state: PlannerState;
let selectedEmployeeId: string | null = null;

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderEmployeePlanningPage(
    container: HTMLElement,
): void {
    const storedShifts = getStoredShifts();
    const storedEmployees = getStoredEmployees();

    state = createInitialPlannerState(storedShifts, storedEmployees);

    selectedEmployeeId = employeeSelectOptions(state.employees)[0]?.employee.id ?? null;

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

        const monthlyTargetMinutes = getMonthlyTargetMinutes(
            selectedEmployee.weeklyTargetMinutes,
            state.selectedYear,
            state.selectedMonth,
        );
        const hoursFromTarget = (summary?.scheduledMinutes ?? 0) - monthlyTargetMinutes;
        const targetDirection = hoursFromTarget < 0
            ? "below target"
            : hoursFromTarget > 0
                ? "above target"
                : "on target";

        const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const availability = selectedEmployee.availability;
        const targetHours = (selectedEmployee.weeklyTargetMinutes / 60).toFixed(1);

        container.innerHTML = `
            <section class="planner">
                <div class="planner-intro employee-planning-intro">
                    <div>
                        <p class="section-label">
                            Workforce
                        </p>

                        <h2>
                            Employee Planning
                        </h2>
                    </div>
                </div>

                <div class="employee-planning-toolbar">
                    <h3 class="employee-planning-name">${escapeHtml(employeeFullName(selectedEmployee))}</h3>

                    <div class="employee-selector">
                        <label for="employee-select">Select Employee</label>
                        <select id="employee-select">
                            ${employeeSelectOptions(state.employees)
                                .map(
                                    ({ employee, label }) => `
                                        <option
                                            value="${escapeHtml(employee.id)}"
                                            ${employee.id === selectedEmployeeId ? "selected" : ""}
                                        >${escapeHtml(label)}</option>
                                    `,
                                )
                                .join("")}
                        </select>
                    </div>
                </div>

                <div class="employee-planning-columns">
                <form class="employee-form" id="employee-form">
                    <h3>Employee Settings</h3>

                    <div class="employee-identity-fields">
                        <div class="form-group">
                            <label for="emp-first-name">First name</label>
                            <input type="text" id="emp-first-name" name="firstName" value="${escapeHtml(selectedEmployee.firstName)}" required />
                        </div>
                        <div class="form-group">
                            <label for="emp-last-name">Last name</label>
                            <input type="text" id="emp-last-name" name="lastName" value="${escapeHtml(selectedEmployee.lastName)}" required />
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="emp-id">Employee ID</label>
                        <input type="text" id="emp-id" name="employeeId" value="${escapeHtml(selectedEmployee.id)}" required />
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
                        <span id="save-status" role="status"></span>
                    </div>
                </form>
                <section class="employee-planning-analytics" aria-label="Monthly employee overview">
                    <p class="section-label">${state.selectedYear}-${String(state.selectedMonth).padStart(2, "0")} Overview</p>
                    <div class="employee-planning-summary">
                        <div class="employee-planning-summary-item">
                            <span class="summary-label">Hours from monthly target</span>
                            <span>
                                <span class="summary-value">${formatMinutes(Math.abs(hoursFromTarget))}</span>
                                <span class="employee-planning-summary-context">${targetDirection}</span>
                            </span>
                        </div>
                        <div class="employee-planning-summary-item">
                            <span class="summary-label">Total scheduled paid hours</span>
                            <span class="summary-value">${formatMinutes(summary?.scheduledMinutes ?? 0)}</span>
                        </div>
                    </div>
                </section>
                </div>
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

            const firstNameInput = container.querySelector<HTMLInputElement>('#emp-first-name');
            const lastNameInput = container.querySelector<HTMLInputElement>('#emp-last-name');
            const idInput = container.querySelector<HTMLInputElement>('#emp-id');
            const targetInput = container.querySelector<HTMLInputElement>('#emp-target-hours');
            const maxDaysSelect = container.querySelector<HTMLSelectElement>('#emp-max-days');
            const earliestInput = container.querySelector<HTMLInputElement>('#emp-earliest');
            const latestInput = container.querySelector<HTMLInputElement>('#emp-latest');

            const firstName = firstNameInput?.value.trim() ?? "";
            const lastName = lastNameInput?.value.trim() ?? "";
            const id = idInput?.value.trim() ?? "";
            const saveStatus = container.querySelector("#save-status");

            if (!firstName || !lastName || !id) {
                if (saveStatus) saveStatus.textContent = "First name, last name, and employee ID are required.";
                return;
            }
            if (id !== selectedEmployee.id && state.employees.some((employee) => employee.id === id)) {
                if (saveStatus) saveStatus.textContent = "This employee ID is already in use.";
                return;
            }
            const targetHoursNum = parseFloat(targetInput?.value ?? "0");
            const maxDays = parseInt(maxDaysSelect?.value ?? "5", 10);

            const dayCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="days"]:checked');
            const days = Array.from(dayCheckboxes).map(cb => parseInt(cb.value, 10));

            const earliest = earliestInput?.value || undefined;
            const latest = latestInput?.value || undefined;

            const updatedEmployee = {
                ...selectedEmployee,
                id,
                firstName,
                lastName,
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

            if (id !== selectedEmployee.id) {
                state.shifts = state.shifts.map((shift) =>
                    shift.employeeId === selectedEmployee.id
                        ? { ...shift, employeeId: id }
                        : shift,
                );
                setStoredShifts(state.shifts);
            }

            selectedEmployeeId = id;

            setStoredEmployees(state.employees);

            render();

            const updatedStatus = container.querySelector("#save-status");
            if (updatedStatus) {
                updatedStatus.textContent = "Saved!";
                setTimeout(() => {
                    updatedStatus.textContent = "";
                }, 2000);
            }
        });
    }

    render();
}
