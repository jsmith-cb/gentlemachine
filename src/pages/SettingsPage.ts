import {
    cloneStoreHours,
    isValidStoreHours,
} from "../services/storeHoursService";
import {
    isValidSchedulingRuleSettings,
    PLANNING_RULE_LABELS,
} from "../services/schedulingRulesService";

import type {
    ConfigurablePlanningRuleId,
    PlanningRuleId,
    SchedulingRuleSettings,
    StoreHours,
    StoreOperatingDay,
    Weekday,
} from "../types/planning";
import {
    confirmDiscardUnsavedChanges,
    formValueSignature,
} from "../components/UnsavedChanges";
import type { PageChangeGuard } from "../components/UnsavedChanges";
import type { CrewApplicationStore } from "../state/CrewApplicationStore";

const DAYS: Array<{ dayOfWeek: Weekday; label: string }> = [
    { dayOfWeek: 1, label: "Monday" },
    { dayOfWeek: 2, label: "Tuesday" },
    { dayOfWeek: 3, label: "Wednesday" },
    { dayOfWeek: 4, label: "Thursday" },
    { dayOfWeek: 5, label: "Friday" },
    { dayOfWeek: 6, label: "Saturday" },
    { dayOfWeek: 0, label: "Sunday" },
];

const CONFIGURABLE_RULES: ConfigurablePlanningRuleId[] = [
    "contracted-hours",
    "opening-hours-coverage",
    "one-saturday-off-per-month",
];

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function dayConfiguration(storeHours: StoreHours, dayOfWeek: Weekday): StoreOperatingDay {
    return storeHours.days.find((day) => day.dayOfWeek === dayOfWeek) ??
        { dayOfWeek, isOpen: false };
}

export function renderSettingsPage(
    container: HTMLElement,
    applicationStore: CrewApplicationStore,
): PageChangeGuard {
    const canonical = applicationStore.getReadyData();
    let storeHours = cloneStoreHours(canonical.settings.storeHours);
    let schedulingRules = structuredClone(canonical.settings.schedulingRules);
    let storeHoursBaseline = "";
    let schedulingRulesBaseline = "";

    function render(): void {
        container.innerHTML = `
            <section class="settings-page">
                <div class="planner-intro">
                    <div>
                        <p class="section-label">Business configuration</p>
                        <h2>Settings</h2>
                    </div>
                </div>

                <form class="store-hours-settings" id="store-hours-form">
                    <details class="settings-collapsible">
                        <summary class="settings-section-heading">
                            <span>
                                <h3>Store Hours</h3>
                                <p>Tell PP_Crew when the business is normally open.</p>
                            </span>
                        </summary>

                        <div class="store-hours-days">
                            ${DAYS.map(({ dayOfWeek, label }) => {
                                const day = dayConfiguration(storeHours, dayOfWeek);
                                const openTime = day.isOpen ? day.openTime : "10:30";
                                const closeTime = day.isOpen ? day.closeTime : "20:30";
                                return `
                                    <fieldset class="store-hours-day" data-store-day="${dayOfWeek}">
                                        <legend>${label}</legend>
                                        <label class="store-day-toggle">
                                            <input type="checkbox" name="open-${dayOfWeek}" ${day.isOpen ? "checked" : ""}>
                                            <span>Open</span>
                                        </label>
                                        <div class="store-day-times">
                                            <label>
                                                <span>Opens</span>
                                                <input type="time" name="start-${dayOfWeek}" value="${escapeHtml(openTime)}"
                                                    ${day.isOpen ? "" : "disabled"} required>
                                            </label>
                                            <span aria-hidden="true">–</span>
                                            <label>
                                                <span>Closes</span>
                                                <input type="time" name="end-${dayOfWeek}" value="${escapeHtml(closeTime)}"
                                                    ${day.isOpen ? "" : "disabled"} required>
                                            </label>
                                        </div>
                                        <span class="store-day-closed" ${day.isOpen ? "hidden" : ""}>Closed</span>
                                    </fieldset>
                                `;
                            }).join("")}
                        </div>

                        <div class="settings-actions">
                            <p class="settings-feedback" role="status"></p>
                            <button class="primary-button" type="submit">Save Store Hours</button>
                        </div>
                    </details>
                </form>

                <form class="store-hours-settings scheduling-rules-settings" id="scheduling-rules-form">
                    <div class="settings-section-heading">
                        <div>
                            <h3>Scheduling Rules</h3>
                            <p>Set generation limits, requirements, and priorities.</p>
                        </div>
                    </div>

                    <div class="scheduling-rule-section">
                        <div>
                            <h4>Limits</h4>
                            <p>Boundaries generated schedules will not cross.</p>
                        </div>
                        <label class="scheduling-limit-field">
                            <span>Minimum generated shift duration</span>
                            <span class="scheduling-duration-input">
                                <input type="number" name="minimumGeneratedShiftHours" min="0.5" max="8"
                                    step="0.5" value="${schedulingRules.minimumGeneratedShiftMinutes / 60}" required>
                                <span>hours</span>
                            </span>
                            <small>Applies to new generated shifts. Managers may still create shorter shifts manually.</small>
                        </label>
                        <p class="settings-context-note">
                            Employee availability, maximum scheduled hours per day, and maximum days per week remain configured in Team.
                        </p>
                    </div>

                    <div class="scheduling-rule-section">
                        <div>
                            <h4>Planning Rules</h4>
                            <p>Choose whether Crew should prefer an outcome or run a dedicated requirement pass.</p>
                        </div>
                        <div class="planning-rule-modes">
                            ${CONFIGURABLE_RULES.map((rule) => `
                                <label>
                                    <span>${PLANNING_RULE_LABELS[rule]}</span>
                                    <select name="mode-${rule}" data-rule-mode="${rule}">
                                        <option value="prefer" ${schedulingRules.modes[rule] === "prefer" ? "selected" : ""}>Prefer</option>
                                        <option value="require" ${schedulingRules.modes[rule] === "require" ? "selected" : ""}>Require</option>
                                    </select>
                                </label>
                            `).join("")}
                        </div>
                    </div>

                    <div class="scheduling-rule-section">
                        <div>
                            <h4>Planning Priorities</h4>
                            <p>Tell Crew what matters most when there is more than one valid way to build the schedule.</p>
                        </div>
                        <ol class="planning-priority-list" data-priority-list>
                            ${schedulingRules.preferredOrder.map((rule) => renderPriorityRule(
                                rule, schedulingRules,
                            )).join("")}
                        </ol>
                    </div>
                    <div class="settings-actions">
                        <p class="settings-feedback" role="status"></p>
                        <button class="primary-button" type="submit">Save Scheduling Rules</button>
                    </div>
                </form>
            </section>
        `;

        const form = container.querySelector<HTMLFormElement>("#store-hours-form");
        const schedulingRulesForm = container.querySelector<HTMLFormElement>("#scheduling-rules-form");
        if (!storeHoursBaseline) storeHoursBaseline = formValueSignature(form);
        if (!schedulingRulesBaseline) schedulingRulesBaseline = formValueSignature(schedulingRulesForm);
        form?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((toggle) => {
            toggle.addEventListener("change", () => {
                const fieldset = toggle.closest<HTMLElement>("[data-store-day]");
                if (!fieldset) return;
                fieldset.querySelectorAll<HTMLInputElement>('input[type="time"]').forEach((input) => {
                    input.disabled = !toggle.checked;
                });
                const closed = fieldset.querySelector<HTMLElement>(".store-day-closed");
                if (closed) closed.hidden = toggle.checked;
            });
        });

        form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const days: StoreOperatingDay[] = DAYS.map(({ dayOfWeek }) => {
                if (data.get(`open-${dayOfWeek}`) !== "on") {
                    return { dayOfWeek, isOpen: false };
                }
                return {
                    dayOfWeek,
                    isOpen: true,
                    openTime: String(data.get(`start-${dayOfWeek}`) ?? ""),
                    closeTime: String(data.get(`end-${dayOfWeek}`) ?? ""),
                };
            });
            const candidate: StoreHours = { days };
            if (!isValidStoreHours(candidate)) {
                const feedback = container.querySelector<HTMLElement>("#store-hours-form .settings-feedback");
                if (feedback) feedback.textContent = "Check that every open day has a valid opening time before its closing time.";
                return;
            }
            const feedback = container.querySelector<HTMLElement>("#store-hours-form .settings-feedback");
            const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
            if (submit) submit.disabled = true;
            if (feedback) feedback.textContent = "Saving Store Hours…";
            try {
                await applicationStore.saveBusinessSettings({
                    storeHours: candidate,
                    schedulingRules,
                });
                storeHours = cloneStoreHours(candidate);
                storeHoursBaseline = formValueSignature(form);
                if (feedback) feedback.textContent = "Store Hours saved.";
            } catch (error) {
                if (feedback) feedback.textContent = persistenceMessage(error, "Store Hours could not be saved.");
            } finally {
                if (submit) submit.disabled = false;
            }
        });

        attachPriorityInteractions(schedulingRulesForm);
        schedulingRulesForm?.querySelectorAll<HTMLSelectElement>("[data-rule-mode]").forEach((select) => {
            select.addEventListener("change", () => {
                const rule = select.dataset.ruleMode as PlanningRuleId;
                const item = schedulingRulesForm.querySelector<HTMLElement>(`[data-priority-rule="${rule}"]`);
                if (item) item.hidden = select.value === "require";
            });
        });

        schedulingRulesForm?.addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();
                const form = event.currentTarget as HTMLFormElement;
                const data = new FormData(form);
                const candidate: SchedulingRuleSettings = {
                    minimumGeneratedShiftMinutes:
                        Math.round(Number(data.get("minimumGeneratedShiftHours")) * 60),
                    modes: {
                        "contracted-hours": String(data.get("mode-contracted-hours")) as "prefer" | "require",
                        "opening-hours-coverage": String(data.get("mode-opening-hours-coverage")) as "prefer" | "require",
                        "one-saturday-off-per-month": String(data.get("mode-one-saturday-off-per-month")) as "prefer" | "require",
                    },
                    preferredOrder: [...form.querySelectorAll<HTMLElement>("[data-priority-rule]")]
                        .map((item) => item.dataset.priorityRule as PlanningRuleId),
                };
                const feedback = container.querySelector<HTMLElement>("#scheduling-rules-form .settings-feedback");
                const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
                if (!isValidSchedulingRuleSettings(candidate)) {
                    if (feedback) feedback.textContent = "Check the scheduling limits and priority order.";
                    return;
                }
                if (submit) submit.disabled = true;
                if (feedback) feedback.textContent = "Saving Scheduling Rules…";
                try {
                    await applicationStore.saveBusinessSettings({
                        storeHours,
                        schedulingRules: candidate,
                    });
                    schedulingRules = structuredClone(candidate);
                    schedulingRulesBaseline = formValueSignature(form);
                    if (feedback) feedback.textContent = "Scheduling Rules saved.";
                } catch (error) {
                    if (feedback) feedback.textContent = persistenceMessage(error, "Scheduling Rules could not be saved.");
                } finally {
                    if (submit) submit.disabled = false;
                }
            },
        );
    }

    render();

    const hasUnsavedChanges = (): boolean =>
        formValueSignature(container.querySelector<HTMLFormElement>("#store-hours-form")) !== storeHoursBaseline ||
        formValueSignature(container.querySelector<HTMLFormElement>("#scheduling-rules-form")) !== schedulingRulesBaseline;

    return {
        hasUnsavedChanges,
        confirmLeave: (trigger) => hasUnsavedChanges()
            ? confirmDiscardUnsavedChanges("Settings", trigger)
            : Promise.resolve(true),
    };
}

function renderPriorityRule(
    rule: PlanningRuleId,
    settings: SchedulingRuleSettings,
): string {
    const required = CONFIGURABLE_RULES.includes(rule as ConfigurablePlanningRuleId) &&
        settings.modes[rule as ConfigurablePlanningRuleId] === "require";
    return `
        <li class="planning-priority" draggable="true" data-priority-rule="${rule}"
            ${required ? "hidden" : ""}>
            <input type="hidden" name="preferredOrder" value="${rule}">
            <span class="planning-priority-handle" aria-hidden="true">☰</span>
            <strong>${PLANNING_RULE_LABELS[rule]}</strong>
            <span class="planning-priority-actions">
                <button type="button" data-priority-move="up" aria-label="Move ${PLANNING_RULE_LABELS[rule]} up">↑</button>
                <button type="button" data-priority-move="down" aria-label="Move ${PLANNING_RULE_LABELS[rule]} down">↓</button>
            </span>
        </li>
    `;
}

function attachPriorityInteractions(form: HTMLFormElement | null): void {
    const list = form?.querySelector<HTMLOListElement>("[data-priority-list]");
    if (!list) return;
    let dragged: HTMLElement | null = null;
    list.querySelectorAll<HTMLElement>("[data-priority-rule]").forEach((item) => {
        item.addEventListener("dragstart", () => {
            dragged = item;
            item.classList.add("planning-priority--dragging");
        });
        item.addEventListener("dragend", () => {
            item.classList.remove("planning-priority--dragging");
            dragged = null;
        });
        item.addEventListener("dragover", (event) => {
            event.preventDefault();
            if (!dragged || dragged === item) return;
            const bounds = item.getBoundingClientRect();
            list.insertBefore(dragged, event.clientY < bounds.top + bounds.height / 2
                ? item : item.nextSibling);
        });
        item.querySelectorAll<HTMLButtonElement>("[data-priority-move]").forEach((button) => {
            button.addEventListener("click", () => {
                const direction = button.dataset.priorityMove;
                const sibling = direction === "up" ? previousVisible(item) : nextVisible(item);
                if (!sibling) return;
                if (direction === "up") list.insertBefore(item, sibling);
                else list.insertBefore(sibling, item);
                button.focus();
            });
        });
    });
}

function previousVisible(item: HTMLElement): HTMLElement | null {
    let sibling = item.previousElementSibling as HTMLElement | null;
    while (sibling?.hidden) sibling = sibling.previousElementSibling as HTMLElement | null;
    return sibling;
}

function nextVisible(item: HTMLElement): HTMLElement | null {
    let sibling = item.nextElementSibling as HTMLElement | null;
    while (sibling?.hidden) sibling = sibling.nextElementSibling as HTMLElement | null;
    return sibling;
}

function persistenceMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}
