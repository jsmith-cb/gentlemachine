import {
    createInitialPlannerState,
} from "../state/plannerState";

import {
    getEmployeeMonthSummaries,
    getAdjustedMonthlyTargetMinutes,
    formatMinutes,
} from "../services/hoursService";
import { employeeSelectOptions } from "../services/employeeIdentity";
import { activeEmployees, createTeamMemberDraft, deactivateTeamMember } from "../services/teamService";
import { hasValidAvailabilityHours } from "../services/availabilityService";
import { isValidVacationPeriod, overlapsVacation } from "../services/vacationService";
import { isValidMaximumPaidMinutesPerDayOverride } from "../services/shiftRules";

import { getStoredShifts, getStoredEmployees, getStoredVacations, getStoredStoreHours, setStoredEmployees, setStoredVacations } from "../services/storageService";

import type { Employee, PlannerState } from "../types/planning";
import {
    confirmDiscardUnsavedChanges,
    formValueSignature,
} from "../components/UnsavedChanges";
import type { PageChangeGuard } from "../components/UnsavedChanges";

let state: PlannerState;
let selectedEmployeeId: string | null = null;
let newEmployeeDraft: Employee | null = null;

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SHORT_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatVacationDate(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    const monthLabel = SHORT_MONTHS[month - 1];
    if (!year || !monthLabel || !day) return date;
    return `${day} ${monthLabel} ${year}`;
}

function formatVacationPeriod(startDate: string, endDate: string): string {
    const start = formatVacationDate(startDate);
    return startDate === endDate
        ? start
        : `${start} – ${formatVacationDate(endDate)}`;
}

export function renderEmployeePlanningPage(
    container: HTMLElement,
): PageChangeGuard {
    const storedShifts = getStoredShifts();
    const storedEmployees = getStoredEmployees();
    const storedVacations = getStoredVacations();

    state = createInitialPlannerState(
        storedShifts, storedEmployees, storedVacations, getStoredStoreHours(),
    );

    newEmployeeDraft = null;
    selectedEmployeeId = employeeSelectOptions(activeEmployees(state.employees))[0]?.employee.id ?? null;
    let employeeBaseline = "";

    const hasUnsavedChanges = (): boolean =>
        newEmployeeDraft !== null ||
        formValueSignature(container.querySelector<HTMLFormElement>("#employee-form")) !== employeeBaseline;

    const confirmLeave = (trigger?: HTMLElement | null): Promise<boolean> =>
        hasUnsavedChanges()
            ? confirmDiscardUnsavedChanges("Team", trigger)
            : Promise.resolve(true);

    async function startAdd(trigger?: HTMLElement | null): Promise<void> {
        if (!await confirmLeave(trigger)) return;
        newEmployeeDraft = createTeamMemberDraft();
        selectedEmployeeId = newEmployeeDraft.id;
        render();
        container.querySelector<HTMLInputElement>("#emp-first-name")?.focus();
    }

    function render(): void {
        const monthSummaries = getEmployeeMonthSummaries(state);
        const selectedEmployee = newEmployeeDraft ?? state.employees.find(
            (e) => e.id === selectedEmployeeId,
        );

        if (!selectedEmployee) {
            container.innerHTML = `
                <section class="planner">
                    <div class="planner-intro employee-planning-intro">
                        <div><p class="section-label">Workforce</p><h2>Team</h2></div>
                    </div>
                    <div class="employee-planning-toolbar">
                        <p>No active team members yet.</p>
                        <button type="button" class="primary-button" id="add-employee">+ Add</button>
                    </div>
                </section>
            `;
            container.querySelector("#add-employee")?.addEventListener("click", (event) => {
                void startAdd(event.currentTarget as HTMLElement);
            });
            employeeBaseline = "";
            return;
        }

        const isNew = newEmployeeDraft !== null;

        const summary = monthSummaries.find(
            ({ employeeId }) => employeeId === selectedEmployee.id,
        );

        const monthlyTargetMinutes = getAdjustedMonthlyTargetMinutes(
            selectedEmployee,
            state.vacations,
            state.selectedYear,
            state.selectedMonth,
        );
        const hoursFromTarget = (summary?.scheduledMinutes ?? 0) - monthlyTargetMinutes;
        const targetDirection = hoursFromTarget < 0
            ? "below target"
            : hoursFromTarget > 0
                ? "above target"
                : "on target";

        const availabilityDays = [
            { value: 1, label: "Mon" }, { value: 2, label: "Tue" },
            { value: 3, label: "Wed" }, { value: 4, label: "Thu" },
            { value: 5, label: "Fri" }, { value: 6, label: "Sat" },
            { value: 0, label: "Sun" },
        ];
        const availability = selectedEmployee.availability;
        const targetHours = (selectedEmployee.weeklyTargetMinutes / 60).toFixed(1);
        const maximumHoursPerDay = selectedEmployee.maximumPaidMinutesPerDay === undefined
            ? ""
            : (selectedEmployee.maximumPaidMinutesPerDay / 60).toFixed(1);
        const employeeVacations = state.vacations
            .filter((period) => period.employeeId === selectedEmployee.id)
            .sort((a, b) => a.startDate.localeCompare(b.startDate));

        container.innerHTML = `
            <section class="planner">
                <div class="planner-intro employee-planning-intro">
                    <div>
                        <p class="section-label">
                            Workforce
                        </p>

                        <h2>
                            Team
                        </h2>
                    </div>

                </div>

                <div class="employee-planning-toolbar">
                    <div class="employee-selector">
                        <label for="employee-select">Select an Employee</label>
                        <select id="employee-select" ${isNew ? "disabled" : ""}>
                            ${isNew ? `<option value="${escapeHtml(selectedEmployee.id)}">New team member</option>` : employeeSelectOptions(activeEmployees(state.employees))
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

                    ${isNew
                        ? '<button type="button" class="secondary-button" id="cancel-add-employee">Cancel</button>'
                        : '<button type="button" class="primary-button" id="add-employee">+ Add</button>'}

					<div class="employee-save-actions">
					    <button
					        type="submit"
					        form="employee-form"
					        class="primary-button"
					    >
				        ${isNew ? "Add team member" : "Save changes"}
				    </button>
				    <span id="save-status" role="status"></span>
					</div>
                </div>

                <section class="employee-summary" aria-labelledby="employee-summary-name">
                    <div class="employee-summary-identity">
                        <div>
                            <p class="section-label">Employee summary</p>
                            <h3 id="employee-summary-name">${escapeHtml(
                                isNew ? "New team member" : `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
                            )}</h3>
                            <p>${escapeHtml(selectedEmployee.employeeNumber || "Employee ID not set")} · ${escapeHtml(targetHours)} hrs/week</p>
                        </div>
                        <span class="employee-status${isNew ? " employee-status--draft" : ""}">${isNew ? "Draft" : "Active"}</span>
                    </div>
                    <div class="employee-summary-metrics">
                        <div><strong>${isNew ? "—" : formatMinutes(summary?.scheduledMinutes ?? 0)}</strong><span>Scheduled this month</span></div>
                        <div><strong>${isNew ? "—" : `${formatMinutes(Math.abs(hoursFromTarget))} ${targetDirection}`}</strong><span>Monthly target after vacation</span></div>
                        <div><strong>${isNew ? "—" : employeeVacations.length ? `${employeeVacations.length} planned` : "None planned"}</strong><span>Vacation</span></div>
                    </div>
                </section>

                <div class="employee-planning-layout">
                <form class="employee-settings-form" id="employee-form">
                    <section class="employee-form employee-details" aria-labelledby="employee-details-heading">
                    <h3 id="employee-details-heading">Employee details</h3>
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
                        <input type="text" id="emp-id" name="employeeNumber" value="${escapeHtml(selectedEmployee.employeeNumber)}" ${isNew ? "" : "readonly"} required />
                        <small class="employee-id-note">${isNew ? "Choose an ID for this team member. It cannot be changed after saving." : "Employee ID is fixed after the team member is added."}</small>
                    </div>

                    <div class="employee-identity-fields">
                        <div class="form-group">
                            <label for="emp-email">Email</label>
                            <input type="email" id="emp-email" name="email" value="${escapeHtml(selectedEmployee.email ?? "")}" autocomplete="email" />
                        </div>
                        <div class="form-group">
                            <label for="emp-telephone">Telephone number</label>
                            <input type="tel" id="emp-telephone" name="telephoneNumber" value="${escapeHtml(selectedEmployee.telephoneNumber ?? "")}" autocomplete="tel" />
                        </div>
                    </div>
                    ${isNew ? "" : `<div class="employee-details-actions"><button type="button" class="secondary-button employee-inactivate-button" id="inactivate-employee">Make inactive</button></div>`}
                    </section>

                    <section class="employee-form employee-availability" aria-labelledby="employee-availability-heading">
                    <h3 id="employee-availability-heading">Scheduling</h3>
                    <div class="scheduling-group">
                    <h4>Targets and limits</h4>
                    <div class="scheduling-limits">
                    <div class="form-group">
                        <label for="emp-target-hours">Weekly Target Hours</label>
                        <input type="number" id="emp-target-hours" name="targetHours" value="${targetHours}" step="0.5" min="0" max="60" required />
                    </div>

                    <div class="form-group">
                        <label for="emp-maximum-hours-per-day">Maximum hours per day</label>
                        <input type="number" id="emp-maximum-hours-per-day" name="maximumHoursPerDay"
                            value="${maximumHoursPerDay}" step="0.5" min="0.5" max="8"
                            placeholder="8" />
                        <small>Leave blank to use Crew's default maximum of 8 paid hours.</small>
                    </div>

                    <div class="form-group">
                        <label for="emp-max-days">Max Days Per Week</label>
                        <select id="emp-max-days" name="maxDays" required>
                            ${[1, 2, 3, 4, 5, 6, 7].map((d) =>
                                `<option value="${d}" ${d === selectedEmployee.maxDaysPerWeek ? "selected" : ""}>${d}</option>`
                            ).join("")}
                        </select>
                    </div>
                    </div>
                    </div>

                    <div class="scheduling-group">
                    <h4>Available days</h4>
                    <div class="form-group">
                        <div class="day-checkboxes">
                            ${availabilityDays.map(({ label, value: day }) => {
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
                    </div>

                    <div class="availability-hours scheduling-group">
                        <h4>Default availability hours</h4>
                        <p>Set default hours, then override them for individual available days. Blank day fields use the defaults.</p>
                        <div class="employee-identity-fields">
                            <div class="form-group">
                                <label for="emp-earliest">Default earliest start</label>
                                <input type="time" id="emp-earliest" name="earliest" value="${availability.earliestStart ?? ""}" />
                            </div>
                            <div class="form-group">
                                <label for="emp-latest">Default latest end</label>
                                <input type="time" id="emp-latest" name="latest" value="${availability.latestEnd ?? ""}" />
                            </div>
                        </div>
                        <button type="button" class="secondary-button apply-hours-button" id="apply-default-hours">
                            Apply default hours to all available days
                        </button>
                        <p class="apply-hours-status" id="apply-hours-status" role="status"></p>
                        <div class="day-hours-section">
                            <h4>Day-specific hours</h4>
                            <div class="day-hours-header" aria-hidden="true">
                                <span>Day</span><span>Earliest</span><span></span><span>Latest</span>
                            </div>
                            <div class="day-hours-list">
                            ${availabilityDays.map(({ label, value: day }) => {
                                const checked = availability.days.includes(day);
                                const hours = availability.dayHours?.[day];
                                return `
                                    <div class="day-hours-row" data-day-hours-row="${day}" ${checked ? "" : "hidden"}>
                                        <strong>${label}</strong>
                                        <label for="day-earliest-${day}" aria-label="${label} earliest start">
                                            <input type="time" id="day-earliest-${day}" name="dayEarliest-${day}" value="${hours?.earliestStart ?? ""}" ${checked ? "" : "disabled"} />
                                        </label>
                                        <span class="day-hours-separator" aria-hidden="true">—</span>
                                        <label for="day-latest-${day}" aria-label="${label} latest end">
                                            <input type="time" id="day-latest-${day}" name="dayLatest-${day}" value="${hours?.latestEnd ?? ""}" ${checked ? "" : "disabled"} />
                                        </label>
                                    </div>
                                `;
                            }).join("")}
                            </div>
                        </div>
                    </div>
                    </section>
                </form>
                <section class="employee-vacation" aria-labelledby="vacation-heading">
                    <h3 id="vacation-heading">Vacation planning</h3>
                    ${isNew ? '<p>Save this team member before planning time off.</p>' : `
                        <p class="vacation-description">Saved days appear on the calendar. Existing shifts are not changed.</p>
                        <form id="vacation-form" class="vacation-form">
                            <label><span>First day</span><input type="date" name="startDate" required /></label>
                            <label><span>Last day</span><input type="date" name="endDate" required /></label>
                            <button type="submit" class="primary-button">Add vacation</button>
                        </form>
                        <p id="vacation-status" class="vacation-status" role="status"></p>
                        ${employeeVacations.length ? `
                            <div class="vacation-scheduled">
                                <h4>Scheduled vacation</h4>
                                <ul class="vacation-periods">
                                    ${employeeVacations.map((period) => `
                                        <li>
                                            <span class="vacation-period-dates">${escapeHtml(formatVacationPeriod(period.startDate, period.endDate))}</span>
                                            <button type="button" class="danger-button vacation-remove-button"
                                                data-remove-vacation="${escapeHtml(period.id)}"
                                                aria-label="Remove vacation ${period.startDate} to ${period.endDate}">Remove</button>
                                        </li>
                                    `).join("")}
                                </ul>
                            </div>
                        ` : '<p class="vacation-empty">No vacation days planned.</p>'}
                    `}
                </section>

                </div>
            </section>
            ${isNew ? "" : `
            <dialog class="employee-inactivate-dialog" id="employee-inactivate-dialog" aria-labelledby="employee-inactivate-title" aria-describedby="employee-inactivate-description">
                <h2 id="employee-inactivate-title">Make team member inactive?</h2>
                <p id="employee-inactivate-description">Make ${escapeHtml(selectedEmployee.firstName)} ${escapeHtml(selectedEmployee.lastName)} inactive? They will no longer be available for new shifts. Existing shifts and vacations will be preserved.</p>
                <form method="dialog" class="employee-inactivate-dialog-actions">
                    <button type="submit" value="cancel" class="secondary-button" autofocus>Cancel</button>
                    <button type="submit" value="confirm" class="danger-button">Make inactive</button>
                </form>
            </dialog>
            `}
        `;

        const selector = container.querySelector<HTMLSelectElement>("#employee-select");
        employeeBaseline = formValueSignature(container.querySelector<HTMLFormElement>("#employee-form"));
        selector?.addEventListener("change", async () => {
            const nextEmployeeId = selector.value || null;
            if (!await confirmLeave(selector)) {
                selector.value = selectedEmployeeId ?? "";
                return;
            }
            selectedEmployeeId = nextEmployeeId;
            render();
        });

        container.querySelector("#add-employee")?.addEventListener("click", (event) => {
            void startAdd(event.currentTarget as HTMLElement);
        });
        container.querySelector("#cancel-add-employee")?.addEventListener("click", async (event) => {
            if (!await confirmLeave(event.currentTarget as HTMLElement)) return;
            newEmployeeDraft = null;
            selectedEmployeeId = employeeSelectOptions(activeEmployees(state.employees))[0]?.employee.id ?? null;
            render();
        });
        const inactivateDialog = container.querySelector<HTMLDialogElement>("#employee-inactivate-dialog");
        container.querySelector("#inactivate-employee")?.addEventListener("click", () => {
            if (!inactivateDialog) return;
            inactivateDialog.returnValue = "";
            inactivateDialog.showModal();
        });
        inactivateDialog?.addEventListener("close", () => {
            if (inactivateDialog.returnValue !== "confirm") return;
            state.employees = deactivateTeamMember(state.employees, selectedEmployee.id);
            setStoredEmployees(state.employees);
            selectedEmployeeId = employeeSelectOptions(activeEmployees(state.employees))[0]?.employee.id ?? null;
            render();
        });

        const vacationForm = container.querySelector<HTMLFormElement>("#vacation-form");
        vacationForm?.addEventListener("submit", (event) => {
            event.preventDefault();
            const formData = new FormData(vacationForm);
            const startDate = String(formData.get("startDate") ?? "");
            const endDate = String(formData.get("endDate") ?? "");
            const period = {
                id: crypto.randomUUID(),
                employeeId: selectedEmployee.id,
                startDate,
                endDate,
            };
            const status = container.querySelector("#vacation-status");
            if (!isValidVacationPeriod(period)) {
                if (status) status.textContent = "Choose a valid first and last day.";
                return;
            }
            if (overlapsVacation(state.vacations, selectedEmployee.id, startDate, endDate)) {
                if (status) status.textContent = "These dates overlap an existing vacation.";
                return;
            }
            state.vacations = [...state.vacations, period];
            setStoredVacations(state.vacations);
            render();
        });

        container.querySelectorAll<HTMLButtonElement>("[data-remove-vacation]").forEach((button) => {
            button.addEventListener("click", () => {
                state.vacations = state.vacations.filter((period) =>
                    period.id !== button.dataset.removeVacation,
                );
                setStoredVacations(state.vacations);
                render();
            });
        });

        const form = container.querySelector<HTMLFormElement>("#employee-form");
        form?.querySelector<HTMLButtonElement>("#apply-default-hours")?.addEventListener("click", () => {
            const earliest = form.querySelector<HTMLInputElement>("#emp-earliest")?.value ?? "";
            const latest = form.querySelector<HTMLInputElement>("#emp-latest")?.value ?? "";
            const status = form.querySelector<HTMLElement>("#apply-hours-status");
            if (!earliest || !latest || earliest >= latest) {
                if (status) status.textContent = "Enter valid default start and end times first.";
                return;
            }
            form.querySelectorAll<HTMLInputElement>('input[name="days"]:checked').forEach((checkbox) => {
                const row = form.querySelector<HTMLElement>(`[data-day-hours-row="${checkbox.value}"]`);
                const dayEarliest = row?.querySelector<HTMLInputElement>(`[name="dayEarliest-${checkbox.value}"]`);
                const dayLatest = row?.querySelector<HTMLInputElement>(`[name="dayLatest-${checkbox.value}"]`);
                if (dayEarliest) dayEarliest.value = earliest;
                if (dayLatest) dayLatest.value = latest;
            });
            if (status) status.textContent = "Default hours copied to available days. Save to keep them.";
        });
        form?.querySelectorAll<HTMLInputElement>('input[name="days"]').forEach((checkbox) => {
            checkbox.addEventListener("change", () => {
                const row = form.querySelector<HTMLElement>(`[data-day-hours-row="${checkbox.value}"]`);
                if (!row) return;
                row.hidden = !checkbox.checked;
                row.querySelectorAll<HTMLInputElement>('input[type="time"]').forEach((input) => {
                    input.disabled = !checkbox.checked;
                });
            });
        });
        form?.addEventListener("submit", (event) => {
            event.preventDefault();

            const firstNameInput = container.querySelector<HTMLInputElement>('#emp-first-name');
            const lastNameInput = container.querySelector<HTMLInputElement>('#emp-last-name');
            const idInput = container.querySelector<HTMLInputElement>('#emp-id');
            const emailInput = container.querySelector<HTMLInputElement>('#emp-email');
            const telephoneInput = container.querySelector<HTMLInputElement>('#emp-telephone');
            const targetInput = container.querySelector<HTMLInputElement>('#emp-target-hours');
            const maximumHoursPerDayInput = container.querySelector<HTMLInputElement>('#emp-maximum-hours-per-day');
            const maxDaysSelect = container.querySelector<HTMLSelectElement>('#emp-max-days');
            const earliestInput = container.querySelector<HTMLInputElement>('#emp-earliest');
            const latestInput = container.querySelector<HTMLInputElement>('#emp-latest');

            const firstName = firstNameInput?.value.trim() ?? "";
            const lastName = lastNameInput?.value.trim() ?? "";
            const employeeNumber = isNew ? idInput?.value.trim() ?? "" : selectedEmployee.employeeNumber;
            const email = emailInput?.value.trim() ?? "";
            const telephoneNumber = telephoneInput?.value.trim() ?? "";
            const saveStatus = container.querySelector("#save-status");

            if (!firstName || !lastName || !employeeNumber) {
                if (saveStatus) saveStatus.textContent = "First name, last name, and employee ID are required.";
                return;
            }
            if (isNew && state.employees.some((employee) =>
                employee.id !== selectedEmployee.id &&
                employee.employeeNumber.toLocaleLowerCase() === employeeNumber.toLocaleLowerCase())) {
                if (saveStatus) saveStatus.textContent = "This employee ID is already in use.";
                return;
            }
            const targetHoursNum = parseFloat(targetInput?.value ?? "0");
            const maximumHoursPerDayValue = maximumHoursPerDayInput?.value.trim() ?? "";
            const maximumHoursPerDay = maximumHoursPerDayValue === ""
                ? undefined
                : parseFloat(maximumHoursPerDayValue);
            const maximumPaidMinutesPerDay = maximumHoursPerDay === undefined
                ? undefined
                : maximumHoursPerDay * 60;
            const maxDays = parseInt(maxDaysSelect?.value ?? "5", 10);

            if (maximumPaidMinutesPerDay !== undefined &&
                !isValidMaximumPaidMinutesPerDayOverride(maximumPaidMinutesPerDay)) {
                if (saveStatus) saveStatus.textContent = "Maximum hours per day must be between 0.5 and 8 hours in 30-minute increments, or left blank.";
                return;
            }

            const dayCheckboxes = form.querySelectorAll<HTMLInputElement>('input[name="days"]:checked');
            const days = Array.from(dayCheckboxes).map(cb => parseInt(cb.value, 10));

            const earliest = earliestInput?.value || undefined;
            const latest = latestInput?.value || undefined;
            const dayHours: NonNullable<typeof selectedEmployee.availability.dayHours> = {};
            for (const day of days) {
                const dayEarliest = form.querySelector<HTMLInputElement>(`[name="dayEarliest-${day}"]`)?.value || undefined;
                const dayLatest = form.querySelector<HTMLInputElement>(`[name="dayLatest-${day}"]`)?.value || undefined;
                if (dayEarliest || dayLatest) {
                    dayHours[day] = { earliestStart: dayEarliest, latestEnd: dayLatest };
                }
            }
            const updatedAvailability = {
                days,
                earliestStart: earliest,
                latestEnd: latest,
                dayHours,
            };
            if (!hasValidAvailabilityHours(updatedAvailability)) {
                if (saveStatus) saveStatus.textContent = "Available hours must have a valid start before the end on each day.";
                return;
            }

            const updatedEmployee = {
                ...selectedEmployee,
                employeeNumber,
                firstName,
                lastName,
                email,
                telephoneNumber,
                weeklyTargetMinutes: Math.round(targetHoursNum * 60),
                maximumPaidMinutesPerDay,
                maxDaysPerWeek: maxDays,
                availability: updatedAvailability,
            };

            state.employees = isNew
                ? [...state.employees, updatedEmployee]
                : state.employees.map((emp) => emp.id === selectedEmployee.id ? updatedEmployee : emp);

            newEmployeeDraft = null;
            selectedEmployeeId = selectedEmployee.id;

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

    return {
        hasUnsavedChanges,
        confirmLeave,
    };
}
