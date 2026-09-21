import {
    getEmployeeMonthSummaries,
    getEmployeeWeekSummaries,
} from "../services/hoursService";

import {
    validatePlannerState,
    validateShift,
} from "../services/validationService";

import { getStoredShifts, setStoredShifts, getStoredEmployees, getStoredVacations } from "../services/storageService";

import {
    createInitialPlannerState,
} from "../state/plannerState";

import type {
    EmployeeMonthSummary,
    EmployeeWeekSummary,
    PlannerState,
    Shift,
    ValidationIssue,
} from "../types/planning";

import {
    renderPlannerCalendar,
} from "./PlannerCalendar";

import type {
    PlannerEditorMode,
} from "./PlannerCalendar";

import {
    renderPlannerMonthlyOverview,
} from "./PlannerMonthlyOverview";

import {
    renderPlannerWeeklyOverview,
} from "./PlannerWeeklyOverview";

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

const PLANNER_TABS = [
    { id: "calendar", label: "Calendar" },
    { id: "weekly", label: "Weekly Overview" },
    { id: "monthly", label: "Monthly Overview" },
] as const;

type PlannerTab = typeof PLANNER_TABS[number]["id"];

export function renderPlannerPage(
    container: HTMLElement,
): void {
    const storedShifts = getStoredShifts();
    const storedEmployees = getStoredEmployees();

    let state = createInitialPlannerState(storedShifts, storedEmployees, getStoredVacations());

    let editorMode:
        | PlannerEditorMode
        | null = null;

    let activeTab: PlannerTab = "calendar";
    let assistantOpen = false;
    let assistantPosition: { x: number; y: number } | null = null;
    let shiftEditorPosition: { x: number; y: number } | null = null;
    let frontWindow: "assistant" | "shift" = "shift";
    let assistantFilter = "all";
    let assistantScrollTop = 0;

    function render(): void {
        const monthSummaries =
            getEmployeeMonthSummaries(
                state,
            );

        const weekSummaries =
            getEmployeeWeekSummaries(
                state,
            );

        const scheduleIssues =
            validatePlannerState(
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

                <div
                    class="planner-tabs"
                    role="tablist"
                    aria-label="Planner views"
                >
                    ${PLANNER_TABS.map((tab) => `
                        <button
                            id="planner-tab-${tab.id}"
                            class="planner-tab${activeTab === tab.id ? " planner-tab--active" : ""}"
                            data-planner-tab="${tab.id}"
                            type="button"
                            role="tab"
                            aria-selected="${activeTab === tab.id}"
                            aria-controls="planner-tabpanel"
                            tabindex="${activeTab === tab.id ? "0" : "-1"}"
                        >
                            ${tab.label}
                        </button>
                    `).join("")}
                </div>

                <div
                    id="planner-tabpanel"
                    class="planner-tabpanel"
                    role="tabpanel"
                    aria-labelledby="planner-tab-${activeTab}"
                >
                    ${renderActiveTab(
                        activeTab,
                        state,
                        editorMode,
                        scheduleIssues,
                        weekSummaries,
                        monthSummaries,
                        assistantOpen,
                    )}
                </div>
            </section>
        `;

        attachNavigationListeners();
        attachTabListeners();
        attachCalendarListeners();
        attachShiftEditorListeners();
        attachValidationFilterListeners();
        attachPlanningAssistantListeners();
        const savedAssistantScrollTop = assistantScrollTop;
        if (assistantFilter !== "all") {
            container.querySelector<HTMLButtonElement>(`[data-validation-filter="${assistantFilter}"]`)?.click();
        }
        const assistantBody = container.querySelector<HTMLElement>(".planning-assistant-body");
        if (assistantBody) assistantBody.scrollTop = savedAssistantScrollTop;
        assistantScrollTop = savedAssistantScrollTop;
    }

    function attachPlanningAssistantListeners(): void {
        const trigger = container.querySelector<HTMLButtonElement>('[data-action="toggle-planning-assistant"]');
        const panel = container.querySelector<HTMLElement>("#planning-assistant-window");
        const closeButton = container.querySelector<HTMLButtonElement>('[data-action="close-planning-assistant"]');
        const handle = container.querySelector<HTMLElement>("[data-assistant-drag-handle]");
        if (!trigger || !panel || !handle) return;

        const moveTo = attachFloatingWindow(panel, handle, () => assistantPosition,
            (position) => { assistantPosition = position; }, "assistant");

        panel.querySelector<HTMLElement>(".planning-assistant-body")?.addEventListener("scroll", (event) => {
            assistantScrollTop = (event.currentTarget as HTMLElement).scrollTop;
        });

        trigger.addEventListener("click", () => {
            assistantOpen = !assistantOpen;
            panel.hidden = !assistantOpen;
            trigger.setAttribute("aria-expanded", String(assistantOpen));
            if (assistantOpen) {
                bringToFront("assistant");
                if (assistantPosition) moveTo(assistantPosition.x, assistantPosition.y);
                panel.querySelector<HTMLElement>("#planning-assistant-title")?.focus();
            }
        });

        closeButton?.addEventListener("click", () => {
            assistantOpen = false;
            panel.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            trigger.focus();
        });

        panel.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeButton?.click();
            }
        });

    }

    function bringToFront(windowName: "assistant" | "shift"): void {
        frontWindow = windowName;
        const assistant = container.querySelector<HTMLElement>("#planning-assistant-window");
        const shift = container.querySelector<HTMLElement>("#shift-editor-window");
        if (assistant) assistant.style.zIndex = frontWindow === "assistant" ? "811" : "800";
        if (shift) shift.style.zIndex = frontWindow === "shift" ? "811" : "800";
    }

    function attachFloatingWindow(
        panel: HTMLElement,
        handle: HTMLElement,
        getPosition: () => { x: number; y: number } | null,
        setPosition: (position: { x: number; y: number }) => void,
        windowName: "assistant" | "shift",
    ): (x: number, y: number) => void {
        const moveTo = (x: number, y: number): void => {
            const minY = window.innerWidth <= 1290 ? 72 : 16;
            const maxX = Math.max(16, window.innerWidth - panel.offsetWidth - 16);
            const maxY = Math.max(minY, window.innerHeight - Math.min(panel.offsetHeight, 64));
            const position = {
                x: Math.min(Math.max(16, x), maxX),
                y: Math.min(Math.max(minY, y), maxY),
            };
            setPosition(position);
            panel.style.left = `${position.x}px`;
            panel.style.top = `${position.y}px`;
            panel.style.right = "auto";
        };

        const position = getPosition();
        if (position) moveTo(position.x, position.y);
        bringToFront(frontWindow);
        panel.addEventListener("pointerdown", () => bringToFront(windowName));

        let drag: { pointerId: number; pointerX: number; pointerY: number; x: number; y: number } | null = null;
        handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
            const bounds = panel.getBoundingClientRect();
            drag = { pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, x: bounds.left, y: bounds.top };
            handle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });
        handle.addEventListener("pointermove", (event) => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            moveTo(drag.x + event.clientX - drag.pointerX, drag.y + event.clientY - drag.pointerY);
        });
        const stopDragging = (event: PointerEvent): void => {
            if (drag?.pointerId === event.pointerId) drag = null;
        };
        handle.addEventListener("pointerup", stopDragging);
        handle.addEventListener("pointercancel", stopDragging);
        return moveTo;
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

                editorMode = null;

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

                editorMode = null;

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
                        now.getMonth() +
                        1,
                };

                editorMode = null;

                render();
            },
        );
    }

    function attachTabListeners(): void {
        const tabs = Array.from(
            container.querySelectorAll<HTMLButtonElement>(
                "[data-planner-tab]",
            ),
        );

        const activateTab = (
            tab: PlannerTab,
            focus: boolean,
        ): void => {
            activeTab = tab;
            editorMode = null;
            render();

            if (focus) {
                container.querySelector<HTMLButtonElement>(
                    `[data-planner-tab="${tab}"]`,
                )?.focus();
            }
        };

        tabs.forEach((tab, index) => {
            tab.addEventListener("click", () => {
                const nextTab = tab.dataset.plannerTab as PlannerTab | undefined;
                if (nextTab && nextTab !== activeTab) activateTab(nextTab, false);
            });

            tab.addEventListener("keydown", (event) => {
                let nextIndex: number | null = null;

                if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
                if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = tabs.length - 1;
                if (nextIndex === null) return;

                event.preventDefault();
                const nextTab = tabs[nextIndex]?.dataset.plannerTab as PlannerTab | undefined;
                if (nextTab) activateTab(nextTab, true);
            });
        });
    }

    function attachCalendarListeners(): void {
        const addButtons =
            container.querySelectorAll<HTMLButtonElement>(
                "[data-add-date]",
            );

        for (
            const button
            of addButtons
        ) {
            button.addEventListener(
                "click",
                () => {
                    const date =
                        button.dataset.addDate;

                    if (!date) {
                        return;
                    }

                    editorMode = {
                        type: "add",
                        date,
                    };

                    render();
                    bringToFront("shift");
                    focusEmployeeField();
                },
            );
        }

        const shiftButtons =
            container.querySelectorAll<HTMLButtonElement>(
                "[data-edit-shift]",
            );

        for (
            const button
            of shiftButtons
        ) {
            button.addEventListener(
                "click",
                () => {
                    const shiftId =
                        button.dataset.editShift;

                    if (!shiftId) {
                        return;
                    }

                    editorMode = {
                        type: "edit",
                        shiftId,
                    };

                    render();
                    bringToFront("shift");
                    focusEmployeeField();
                },
            );
        }
    }

    function attachShiftEditorListeners(): void {
        const form =
            container.querySelector<HTMLFormElement>(
                "#shift-form",
            );

        const cancelButtons = container.querySelectorAll<HTMLButtonElement>(
            '[data-action="cancel-shift"]',
        );

        const deleteButton =
            container.querySelector<HTMLButtonElement>(
                '[data-action="delete-shift"]',
            );

        for (const button of cancelButtons) {
            button.addEventListener("click", () => {
                editorMode = null;
                render();
            });
        }

        const panel = container.querySelector<HTMLElement>("#shift-editor-window");
        const handle = container.querySelector<HTMLElement>("[data-shift-drag-handle]");
        if (panel && handle) {
            attachFloatingWindow(panel, handle, () => shiftEditorPosition,
                (position) => { shiftEditorPosition = position; }, "shift");
            panel.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    cancelButtons[0]?.click();
                }
            });
        }
		
		deleteButton?.addEventListener(
		    "click",
		    () => {
		        if (
		            !editorMode ||
		            editorMode.type !==
		                "edit"
		        ) {
		            return;
		        }

		        const shiftId =
		            editorMode.shiftId;

		        state = {
		            ...state,
		            shifts:
		                state.shifts.filter(
		                    ({ id }) =>
		                        id !==
		                        shiftId,
		                ),
		        };

		        setStoredShifts(state.shifts);
		        editorMode = null;

		        render();
		    },
		);

        if (!form) {
            return;
        }

        const updateValidation =
            (): ValidationIssue[] => {
                const draft =
                    createShiftFromForm(
                        form,
                        editorMode,
                        state,
                    );

                if (!draft) {
                    renderEditorIssues(
                        container,
                        [],
                        false,
                    );

                    updateSaveButton(
                        container,
                        true,
                    );

                    return [];
                }

                const issues =
                    validateShift(
                        state,
                        draft,
                    );

                renderEditorIssues(
                    container,
                    issues,
                    true,
                );

                updateSaveButton(
                    container,
                    issues.some(
                        ({ severity }) =>
                            severity ===
                            "error",
                    ),
                );

                return issues;
            };

        const fields =
            form.querySelectorAll<
                HTMLInputElement |
                HTMLSelectElement
            >(
                "input, select",
            );

        for (
            const field
            of fields
        ) {
            field.addEventListener(
                "input",
                updateValidation,
            );

            field.addEventListener(
                "change",
                updateValidation,
            );
        }

        updateValidation();

        form.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();

                const shift =
                    createShiftFromForm(
                        form,
                        editorMode,
                        state,
                    );

                if (!shift) {
                    return;
                }

                const issues =
                    validateShift(
                        state,
                        shift,
                    );

                const hasErrors =
                    issues.some(
                        ({ severity }) =>
                            severity ===
                            "error",
                    );

                if (hasErrors) {
                    return;
                }

                if (
                    editorMode?.type ===
                    "edit"
                ) {
                    state = {
                        ...state,
                        shifts:
                            state.shifts.map(
                                (existingShift) =>
                                    existingShift.id ===
                                    shift.id
                                        ? shift
                                        : existingShift,
                            ),
                    };

				setStoredShifts(state.shifts);
                } else {
                    state = {
                        ...state,
                        shifts: [
                            ...state.shifts,
                            shift,
                        ],
                    };

				setStoredShifts(state.shifts);
                }

                editorMode = null;

                render();
            },
        );
    }

    function attachValidationFilterListeners(): void {
        const filterButtons =
            container.querySelectorAll<HTMLButtonElement>(
                "[data-validation-filter]",
            );

        const issueElements =
            container.querySelectorAll<HTMLElement>(
                "[data-validation-issue]",
            );

        const resultCount =
            container.querySelector<HTMLElement>(
                "#validation-result-count",
            );

        for (
            const button
            of filterButtons
        ) {
            button.addEventListener(
                "click",
                () => {
                    const filter =
                        button.dataset.validationFilter;

                    if (!filter) {
                        return;
                    }

                    assistantFilter = filter;
                    assistantScrollTop = 0;
                    const assistantBody = container.querySelector<HTMLElement>(".planning-assistant-body");
                    if (assistantBody) assistantBody.scrollTop = 0;

                    for (
                        const candidate
                        of filterButtons
                    ) {
                        candidate.classList.toggle(
                            "validation-filter--active",
                            candidate === button,
                        );

                        candidate.setAttribute(
                            "aria-pressed",
                            candidate === button
                                ? "true"
                                : "false",
                        );
                    }

                    let visibleCount = 0;

                    for (
                        const issueElement
                        of issueElements
                    ) {
                        const severity =
                            issueElement.dataset.severity;

                        const category =
                            issueElement.dataset.category;

                        const visible =
                            filter === "all" ||
                            severity === filter ||
                            category === filter;

                        issueElement.hidden =
                            !visible;

                        if (visible) {
                            visibleCount += 1;
                        }
                    }

                    if (resultCount) {
                        resultCount.textContent =
                            `${visibleCount} issue${visibleCount === 1 ? "" : "s"}`;
                    }
                },
            );
        }
    }

    function focusEmployeeField(): void {
        const employeeSelect =
            container.querySelector<HTMLSelectElement>(
                "#shift-employee",
            );

        employeeSelect?.focus();
    }

    render();
}

function renderActiveTab(
    activeTab: PlannerTab,
    state: PlannerState,
    editorMode: PlannerEditorMode | null,
    scheduleIssues: ValidationIssue[],
    weekSummaries: EmployeeWeekSummary[],
    monthSummaries: EmployeeMonthSummary[],
    assistantOpen: boolean,
): string {
    if (activeTab === "weekly") {
        return renderPlannerWeeklyOverview(state, weekSummaries);
    }

    if (activeTab === "monthly") {
        return renderPlannerMonthlyOverview(state, monthSummaries);
    }

    return renderPlannerCalendar(state, editorMode, scheduleIssues, assistantOpen);
}

function createShiftFromForm(
    form: HTMLFormElement,
    editorMode:
        | PlannerEditorMode
        | null,
    state: PlannerState,
): Shift | null {
    if (!editorMode) {
        return null;
    }

    const formData =
        new FormData(
            form,
        );

    const employeeId =
        String(
            formData.get(
                "employeeId",
            ) ?? "",
        );

    const start =
        String(
            formData.get(
                "start",
            ) ?? "",
        );

    const end =
        String(
            formData.get(
                "end",
            ) ?? "",
        );

    if (
        !employeeId ||
        !start ||
        !end
    ) {
        return null;
    }

    if (
        editorMode.type ===
        "edit"
    ) {
        const existingShift =
            state.shifts.find(
                ({ id }) =>
                    id ===
                    editorMode.shiftId,
            );

        if (!existingShift) {
            return null;
        }

        return {
            ...existingShift,
            employeeId,
            start,
            end,
        };
    }

    return {
        id:
            createShiftId(),
        employeeId,
        date:
            editorMode.date,
        start,
        end,
    };
}

function renderEditorIssues(
    container: HTMLElement,
    issues: ValidationIssue[],
    hasDraft: boolean,
): void {
    const validationContainer =
        container.querySelector<HTMLElement>(
            "#shift-validation",
        );

    if (!validationContainer) {
        return;
    }

    if (!hasDraft) {
        validationContainer.textContent = "";
        validationContainer.hidden = true;
        return;
    }

    validationContainer.hidden = false;

    if (issues.length === 0) {
        validationContainer.innerHTML =
            '<p class="validation-message validation-message--success">Available for this day and these hours.</p>';
        return;
    }

    validationContainer.innerHTML =
        issues
            .map(
                (issue) => `
                    <p class="validation-message validation-message--${issue.severity}">
                        ${issue.severity === "error" ? "Error:" : "Warning:"}
                        ${issue.message}
                    </p>
                `,
            )
            .join("");
}

function updateSaveButton(
    container: HTMLElement,
    disabled: boolean,
): void {
    const button =
        container.querySelector<HTMLButtonElement>(
            "#save-shift-button",
        );

    if (button) {
        button.disabled =
            disabled;
    }
}

function changeMonth(
    state: PlannerState,
    amount: number,
): PlannerState {
    const date =
        new Date(
            state.selectedYear,
            state.selectedMonth -
                1 +
                amount,
            1,
        );

    return {
        ...state,
        selectedYear:
            date.getFullYear(),
        selectedMonth:
            date.getMonth() +
            1,
    };
}

function createShiftId(): string {
    if (
        typeof crypto !==
            "undefined" &&
        "randomUUID" in
            crypto
    ) {
        return crypto.randomUUID();
    }

    return [
        "shift",
        Date.now(),
        Math.random()
            .toString(16)
            .slice(2),
    ].join("-");
}
