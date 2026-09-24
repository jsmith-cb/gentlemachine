import { employeeFullName } from "../services/employeeIdentity";
import { availableTeamForDay } from "../services/dayPlanningService";
import { isValidTime } from "../services/availabilityService";
import { timeToMinutes } from "../services/hoursService";
import { validateShift } from "../services/validationService";
import { getOperatingHoursForDate } from "../services/storeHoursService";
import type { PlannerState, Shift } from "../types/planning";

const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 42;

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toTime(minutes: number): string {
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function dateLabel(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        .format(new Date(year, month - 1, day));
}

export function renderDayPlanningModal(state: PlannerState, date: string): string {
    const operating = getOperatingHoursForDate(state.storeHours, date);
    return `
        <dialog class="day-planner-dialog" id="day-planner-dialog" aria-labelledby="day-planner-title">
            <div class="day-planner-header">
                <div><p class="section-label">Day planning</p><h2 id="day-planner-title">${dateLabel(date)}</h2>
                    <span>${operating ? `${escapeHtml(operating.open)}–${escapeHtml(operating.close)}` : "Closed"}</span></div>
                <button type="button" class="day-planner-close" data-day-close aria-label="Close day planning">×</button>
            </div>
            <div class="day-planner-content"></div>
        </dialog>
    `;
}

export function attachDayPlanningModal(
    dialog: HTMLDialogElement,
    state: PlannerState,
    date: string,
    initialShiftId: string | null,
    onSave: (upserts: Shift[], deletions: string[]) => void,
    onClose: () => void,
): void {
    const operating = getOperatingHoursForDate(state.storeHours, date);
    if (!operating) return;
    const storeOpen = operating.open;
    const storeClose = operating.close;
    const availableTeam = availableTeamForDay(state, date);
    const opening = timeToMinutes(storeOpen);
    const closing = timeToMinutes(storeClose);
    const slotCount = Math.ceil((closing - opening) / SLOT_MINUTES);
    const dayShifts = state.shifts.filter((shift) => shift.date === date);
    const initialShift = dayShifts.find((shift) => shift.id === initialShiftId);
    const drafts = new Map<string, Shift>();
    const pendingDeletes = new Set<string>();
    let activeDraftId: string | null = initialShift?.id ?? null;
    let selectedEmployeeId: string | null = initialShift?.employeeId ?? null;
    let resize: { pointerId: number; edge: "start" | "end" } | null = null;

    const activeDraft = (): Shift | null => drafts.get(activeDraftId ?? "") ??
        dayShifts.find(({ id }) => id === activeDraftId) ?? null;

    function stageDraft(shift: Shift): void {
        drafts.set(shift.id, shift);
        activeDraftId = shift.id;
    }

    function draftError(shift: Shift): string | null {
        if (!isValidTime(shift.start) || !isValidTime(shift.end)) return "Enter a valid start and end time.";
        if (timeToMinutes(shift.start) < opening || timeToMinutes(shift.end) > closing)
            return "Shift must stay within store hours.";
        return validateShift(state, shift).find(({ severity }) => severity === "error")?.message ?? null;
    }

    function slots(): string {
        const selected = availableTeam.find(({ employee }) => employee.id === selectedEmployeeId);
        return Array.from({ length: slotCount }, (_, index) => {
            const start = opening + index * SLOT_MINUTES;
            const end = Math.min(closing, start + SLOT_MINUTES);
            const blocked = Boolean(selectedEmployeeId) && (!selected ||
                start < timeToMinutes(selected.start) || end > timeToMinutes(selected.end));
            return `<button type="button" class="day-planner-slot${blocked ? " day-planner-slot--blocked" : ""}"
                data-slot="${start}" ${blocked ? "disabled" : ""}
                aria-label="${toTime(start)}${blocked ? ", unavailable for selected team member" : ", start shift here"}">
                <span>${toTime(start)}</span><span></span></button>`;
        }).join("");
    }

    function shiftBlocks(): string {
        const displayShifts = dayShifts
            .filter(({ id }) => !pendingDeletes.has(id))
            .map((shift) => drafts.get(shift.id) ?? shift);
        displayShifts.push(...[...drafts.values()].filter((shift) => !dayShifts.some(({ id }) => id === shift.id)));
        const ordered = [...displayShifts].sort((a, b) => a.start.localeCompare(b.start));
        const laneEnds: number[] = [];
        const placement = ordered.map((shift) => {
            const start = timeToMinutes(shift.start);
            let lane = laneEnds.findIndex((end) => end <= start);
            if (lane < 0) lane = laneEnds.length;
            laneEnds[lane] = timeToMinutes(shift.end);
            return { shift, lane };
        });
        const laneCount = Math.max(1, laneEnds.length);
        return placement.map(({ shift, lane }) => {
            const employee = state.employees.find(({ id }) => id === shift.employeeId);
            const isDraft = shift.id === activeDraftId;
            const isPending = drafts.has(shift.id);
            const top = Math.max(0, (timeToMinutes(shift.start) - opening) / SLOT_MINUTES * SLOT_HEIGHT);
            const height = Math.max(SLOT_HEIGHT / 2, (timeToMinutes(shift.end) - timeToMinutes(shift.start)) / SLOT_MINUTES * SLOT_HEIGHT);
            return `<div class="day-planner-shift${isDraft ? " day-planner-shift--draft" : ""}${isPending ? " day-planner-shift--pending" : ""}"
                ${isDraft ? "data-draft-block" : ""} data-select-shift="${escapeHtml(shift.id)}"
                style="top:${top}px;height:${height}px;left:calc(72px + (100% - 72px) * ${lane} / ${laneCount});width:calc((100% - 72px) / ${laneCount} - 6px)"
                role="button" tabindex="0" aria-label="Edit shift for ${escapeHtml(employee ? employeeFullName(employee) : shift.employeeId)}${isPending ? ", unsaved" : ""}">
                ${isDraft ? '<span class="day-planner-resize" data-resize="start" aria-hidden="true"></span>' : ""}
                <strong>${escapeHtml(employee ? employeeFullName(employee) : shift.employeeId)}</strong>
                <span class="day-planner-shift-time">${escapeHtml(shift.start)}–${escapeHtml(shift.end)}${isPending ? " · Unsaved" : ""}</span>
                ${isDraft ? '<span class="day-planner-resize day-planner-resize--end" data-resize="end" aria-hidden="true"></span>' : ""}
            </div>`;
        }).join("");
    }

    function editor(): string {
        const draft = activeDraft();
        if (!draft) return `<p class="day-planner-prompt">Drag a team member onto the timeline, or select a person and a time slot. Add several shifts before saving them together.</p>`;
        const isExisting = dayShifts.some((shift) => shift.id === draft?.id);
        const issue = draftError(draft);
        const employee = state.employees.find(({ id }) => id === draft?.employeeId);
        return `<form class="day-planner-editor" id="day-planner-editor">
            <div class="day-planner-editor-heading"><strong>${escapeHtml(employee ? employeeFullName(employee) : draft.employeeId)}</strong>
                <span>${isExisting ? drafts.has(draft.id) ? "Unsaved changes to existing shift" : "Editing existing shift" : "Unsaved shift draft"}</span></div>
            <div class="day-planner-time-fields">
                <label>Team member <select name="employeeId" required>
                    ${!availableTeam.some(({ employee: available }) => available.id === draft?.employeeId)
                        ? `<option value="${escapeHtml(draft.employeeId)}" selected disabled>${escapeHtml(employee ? employeeFullName(employee) : draft.employeeId)} (unavailable)</option>` : ""}
                    ${availableTeam.map(({ employee: available }) => `<option value="${escapeHtml(available.id)}" ${available.id === draft?.employeeId ? "selected" : ""}>${escapeHtml(employeeFullName(available))}</option>`).join("")}
                </select></label>
                <label>Start <input type="time" name="start" value="${escapeHtml(draft.start)}" min="${storeOpen}" max="${storeClose}" required></label>
                <label>End <input type="time" name="end" value="${escapeHtml(draft.end)}" min="${storeOpen}" max="${storeClose}" required></label>
            </div>
            <div class="day-planner-issues" role="status">${issue ? escapeHtml(issue) : "Available for these hours."}</div>
            <div class="day-planner-editor-actions">
                ${isExisting ? '<button type="button" class="danger-button" data-day-delete>Remove on Save</button>' : '<button type="button" class="secondary-button" data-day-discard>Discard this draft</button>'}
                ${isExisting && drafts.has(draft.id) ? '<button type="button" class="secondary-button" data-day-discard>Revert changes</button>' : ""}
            </div>
        </form>`;
    }

    function batchActions(): string {
        const count = drafts.size + pendingDeletes.size;
        if (!count) return "";
        const invalid = [...drafts.values()].some((shift) => draftError(shift) !== null);
        return `<div class="day-planner-batch-actions">
            <span>${drafts.size} pending shift change${drafts.size === 1 ? "" : "s"}${pendingDeletes.size ? ` · ${pendingDeletes.size} removal${pendingDeletes.size === 1 ? "" : "s"}` : ""}</span>
            <button type="button" class="primary-button" data-save-all ${invalid ? "disabled" : ""}>Save all changes</button>
        </div>`;
    }

    function refresh(): void {
        const content = dialog.querySelector<HTMLElement>(".day-planner-content");
        if (!content) return;
        const timelineScroll = content.querySelector<HTMLElement>(".day-planner-scroll")?.scrollTop ?? 0;
        content.innerHTML = `<div class="day-planner-main">
            <section class="day-planner-timeline-section" aria-label="Day timeline">
                <h3>Day timeline</h3>
                <div class="day-planner-scroll" tabindex="0" aria-label="Scroll day timeline"><div class="day-planner-timeline" data-timeline>
                    ${slots()}${shiftBlocks()}<div class="day-planner-closing">${storeClose}</div>
                </div></div>
            </section>
            <aside class="day-planner-team" aria-label="Available team"><h3>Available team</h3>
                ${availableTeam.length ? availableTeam.map(({ employee, start, end, fullDay }) =>
                    `<button type="button" draggable="true" data-day-employee="${escapeHtml(employee.id)}"
                        class="day-planner-person${selectedEmployeeId === employee.id ? " day-planner-person--selected" : ""}">
                        <strong>${escapeHtml(employeeFullName(employee))}</strong>
                        <span>${fullDay ? "Available" : `${start}–${end}`}</span></button>`).join("") :
                    '<p>No team members are available on this day.</p>'}
            </aside>
        </div>${editor()}${batchActions()}`;
        const updatedScroll = content.querySelector<HTMLElement>(".day-planner-scroll");
        if (updatedScroll) updatedScroll.scrollTop = timelineScroll;
    }

    function selectSlot(minutes: number, employeeId = selectedEmployeeId): void {
        const person = availableTeam.find(({ employee }) => employee.id === employeeId);
        if (!person || minutes < timeToMinutes(person.start) || minutes >= timeToMinutes(person.end)) return;
        const end = Math.min(closing, timeToMinutes(person.end), minutes + 60);
        if (end <= minutes) return;
        selectedEmployeeId = person.employee.id;
        stageDraft({ id: crypto.randomUUID(), employeeId: person.employee.id, date, start: toTime(minutes), end: toTime(end) });
        refresh();
    }

    function stageActiveForm(): void {
        const current = activeDraft();
        const form = dialog.querySelector<HTMLFormElement>("#day-planner-editor");
        if (!current || !form) return;
        const data = new FormData(form);
        const candidate = { ...current, employeeId: String(data.get("employeeId") ?? ""),
            start: String(data.get("start") ?? ""), end: String(data.get("end") ?? "") };
        if (drafts.has(current.id) || candidate.employeeId !== current.employeeId ||
            candidate.start !== current.start || candidate.end !== current.end) stageDraft(candidate);
    }

    function saveAll(): void {
        stageActiveForm();
        const invalid = [...drafts.values()].find((shift) => draftError(shift) !== null);
        if (invalid) {
            activeDraftId = invalid.id;
            refresh();
            return;
        }
        if (drafts.size || pendingDeletes.size) onSave([...drafts.values()], [...pendingDeletes]);
    }

    refresh();
    dialog.showModal();
    dialog.addEventListener("close", onClose);
    dialog.querySelector("[data-day-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const person = target.closest<HTMLElement>("[data-day-employee]");
        if (person) {
            selectedEmployeeId = person.dataset.dayEmployee ?? null;
            refresh();
            return;
        }
        const existing = target.closest<HTMLElement>("[data-select-shift]");
        if (existing) {
            const shiftId = existing.dataset.selectShift ?? "";
            const shift = drafts.get(shiftId) ?? dayShifts.find(({ id }) => id === shiftId);
            if (shift) { activeDraftId = shift.id; selectedEmployeeId = shift.employeeId; refresh(); }
            return;
        }
        if (target.closest("[data-day-discard]")) {
            if (activeDraftId) drafts.delete(activeDraftId);
            activeDraftId = null;
            refresh();
            return;
        }
        if (target.closest("[data-day-delete]")) {
            if (activeDraftId && dayShifts.some(({ id }) => id === activeDraftId)) {
                drafts.delete(activeDraftId);
                pendingDeletes.add(activeDraftId);
                activeDraftId = null;
                refresh();
            }
            return;
        }
        if (target.closest("[data-save-all]")) {
            saveAll();
            return;
        }
        const slot = target.closest<HTMLElement>("[data-slot]");
        if (slot && !target.closest("[data-draft-block]")) selectSlot(Number(slot.dataset.slot));
    });
    dialog.addEventListener("keydown", (event) => {
        const target = event.target as HTMLElement;
        if ((event.key === "Enter" || event.key === " ") && target.matches("[data-select-shift]")) {
            event.preventDefault(); target.click();
        }
    });
    dialog.addEventListener("dragstart", (event) => {
        const person = (event.target as HTMLElement).closest<HTMLElement>("[data-day-employee]");
        if (!person?.dataset.dayEmployee || !event.dataTransfer) return;
        event.dataTransfer.setData("text/plain", person.dataset.dayEmployee);
        event.dataTransfer.effectAllowed = "copy";
        selectedEmployeeId = person.dataset.dayEmployee;
        const selected = availableTeam.find(({ employee }) => employee.id === selectedEmployeeId);
        dialog.querySelectorAll<HTMLElement>("[data-slot]").forEach((slot) => {
            const start = Number(slot.dataset.slot);
            const blocked = !selected || start < timeToMinutes(selected.start) ||
                Math.min(closing, start + SLOT_MINUTES) > timeToMinutes(selected.end);
            (slot as HTMLButtonElement).disabled = blocked;
            slot.classList.toggle("day-planner-slot--blocked", blocked);
        });
    });
    dialog.addEventListener("dragover", (event) => {
        if ((event.target as HTMLElement).closest("[data-timeline]")) event.preventDefault();
    });
    dialog.addEventListener("drop", (event) => {
        const timeline = (event.target as HTMLElement).closest<HTMLElement>("[data-timeline]");
        if (!timeline) return;
        event.preventDefault();
        const employeeId = event.dataTransfer?.getData("text/plain");
        if (!employeeId) return;
        const minutes = opening + Math.floor((event.clientY - timeline.getBoundingClientRect().top) / SLOT_HEIGHT) * SLOT_MINUTES;
        selectSlot(minutes, employeeId);
    });
    dialog.addEventListener("dragend", () => {
        selectedEmployeeId = activeDraft()?.employeeId ?? null;
        refresh();
    });
    dialog.addEventListener("change", (event) => {
        const field = event.target as HTMLInputElement | HTMLSelectElement;
        const draft = activeDraft();
        if (!draft || !field.closest("#day-planner-editor") ||
            (field.name !== "start" && field.name !== "end" && field.name !== "employeeId")) return;
        stageDraft({ ...draft, [field.name]: field.value });
        if (field.name === "employeeId") selectedEmployeeId = field.value;
        refresh();
    });
    dialog.addEventListener("submit", (event) => {
        if (!(event.target as HTMLElement).matches("#day-planner-editor")) return;
        event.preventDefault();
        saveAll();
    });
    dialog.addEventListener("pointerdown", (event) => {
        const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-resize]");
        if (!handle || !activeDraft()) return;
        resize = { pointerId: event.pointerId, edge: handle.dataset.resize as "start" | "end" };
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
    });
    dialog.addEventListener("pointermove", (event) => {
        const draft = activeDraft();
        if (!resize || resize.pointerId !== event.pointerId || !draft) return;
        const timeline = dialog.querySelector<HTMLElement>("[data-timeline]");
        const block = dialog.querySelector<HTMLElement>("[data-draft-block]");
        if (!timeline || !block) return;
        const snapped = opening + Math.round((event.clientY - timeline.getBoundingClientRect().top) / SLOT_HEIGHT) * SLOT_MINUTES;
        const start = timeToMinutes(draft.start);
        const end = timeToMinutes(draft.end);
        const next = resize.edge === "start"
            ? Math.max(opening, Math.min(end - SLOT_MINUTES, snapped))
            : Math.min(closing, Math.max(start + SLOT_MINUTES, snapped));
        const updated = resize.edge === "start" ? { ...draft, start: toTime(next) } : { ...draft, end: toTime(next) };
        stageDraft(updated);
        block.style.top = `${(timeToMinutes(updated.start) - opening) / SLOT_MINUTES * SLOT_HEIGHT}px`;
        block.style.height = `${(timeToMinutes(updated.end) - timeToMinutes(updated.start)) / SLOT_MINUTES * SLOT_HEIGHT}px`;
        const label = block.querySelector<HTMLElement>(".day-planner-shift-time");
        if (label) label.textContent = `${updated.start}–${updated.end} · Unsaved`;
    });
    const finishResize = (event: PointerEvent): void => {
        if (resize?.pointerId === event.pointerId) { resize = null; refresh(); }
    };
    dialog.addEventListener("pointerup", finishResize);
    dialog.addEventListener("pointercancel", finishResize);
}
