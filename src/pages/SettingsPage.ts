import {
    getStoredStoreHours,
    getStoredSoftRuleSettings,
    setStoredStoreHours,
    setStoredSoftRuleSettings,
} from "../services/storageService";
import {
    cloneStoreHours,
    isValidStoreHours,
} from "../services/storeHoursService";

import type { StoreHours, StoreOperatingDay, Weekday } from "../types/planning";
import {
    confirmDiscardUnsavedChanges,
    formValueSignature,
} from "../components/UnsavedChanges";
import type { PageChangeGuard } from "../components/UnsavedChanges";

const DAYS: Array<{ dayOfWeek: Weekday; label: string }> = [
    { dayOfWeek: 1, label: "Monday" },
    { dayOfWeek: 2, label: "Tuesday" },
    { dayOfWeek: 3, label: "Wednesday" },
    { dayOfWeek: 4, label: "Thursday" },
    { dayOfWeek: 5, label: "Friday" },
    { dayOfWeek: 6, label: "Saturday" },
    { dayOfWeek: 0, label: "Sunday" },
];

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function dayConfiguration(storeHours: StoreHours, dayOfWeek: Weekday): StoreOperatingDay {
    return storeHours.days.find((day) => day.dayOfWeek === dayOfWeek) ??
        { dayOfWeek, isOpen: false };
}

export function renderSettingsPage(container: HTMLElement): PageChangeGuard {
    let storeHours = getStoredStoreHours();
    let softRules = getStoredSoftRuleSettings();
    let storeHoursBaseline = "";
    let softRulesBaseline = "";

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

                <form class="store-hours-settings soft-rules-settings" id="soft-rules-form">
                    <div class="settings-section-heading">
                        <div>
                            <h3>Soft Rules</h3>
                            <p>Set scheduling outcomes Crew should try to achieve.</p>
                        </div>
                    </div>
                    <label class="soft-rule-option">
                        <input type="checkbox" name="oneWeekendOffPerMonth"
                            ${softRules.oneWeekendOffPerMonth ? "checked" : ""}>
                        <span>
                            <strong>One weekend off per month</strong>
                            <small>Help give each team member at least one weekend off each month.</small>
                        </span>
                    </label>
                    <div class="settings-actions">
                        <p class="settings-feedback" role="status"></p>
                        <button class="primary-button" type="submit">Save Soft Rules</button>
                    </div>
                </form>
            </section>
        `;

        const form = container.querySelector<HTMLFormElement>("#store-hours-form");
        const softRulesForm = container.querySelector<HTMLFormElement>("#soft-rules-form");
        if (!storeHoursBaseline) storeHoursBaseline = formValueSignature(form);
        if (!softRulesBaseline) softRulesBaseline = formValueSignature(softRulesForm);
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

        form?.addEventListener("submit", (event) => {
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
            setStoredStoreHours(candidate);
            storeHours = cloneStoreHours(candidate);
            storeHoursBaseline = formValueSignature(form);
            const feedback = container.querySelector<HTMLElement>("#store-hours-form .settings-feedback");
            if (feedback) feedback.textContent = "Store Hours saved.";
        });

        softRulesForm?.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();
                const form = event.currentTarget as HTMLFormElement;
                softRules = {
                    oneWeekendOffPerMonth:
                        new FormData(form).get("oneWeekendOffPerMonth") === "on",
                };
                setStoredSoftRuleSettings(softRules);
                softRulesBaseline = formValueSignature(form);
                const feedback = container.querySelector<HTMLElement>("#soft-rules-form .settings-feedback");
                if (feedback) feedback.textContent = "Soft Rules saved.";
            },
        );
    }

    render();

    const hasUnsavedChanges = (): boolean =>
        formValueSignature(container.querySelector<HTMLFormElement>("#store-hours-form")) !== storeHoursBaseline ||
        formValueSignature(container.querySelector<HTMLFormElement>("#soft-rules-form")) !== softRulesBaseline;

    return {
        hasUnsavedChanges,
        confirmLeave: (trigger) => hasUnsavedChanges()
            ? confirmDiscardUnsavedChanges("Settings", trigger)
            : Promise.resolve(true),
    };
}
