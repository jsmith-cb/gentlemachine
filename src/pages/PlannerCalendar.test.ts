import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import { renderPlannerCalendar } from "./PlannerCalendar";

describe("Planner calendar vacation markers", () => {
    it("shows saved vacation days without changing scheduled shifts", () => {
        const state = createInitialPlannerState(
            [{ id: "shift-1", employeeId: "a", date: "2026-09-29", start: "10:30", end: "15:30" }],
            undefined,
            [{ id: "vacation-1", employeeId: "a", startDate: "2026-09-29", endDate: "2026-10-02" }],
        );
        state.selectedYear = 2026;
        state.selectedMonth = 9;

        const html = renderPlannerCalendar(state, null, []);
        expect(html).toContain("Employee A · Vacation");
        expect(html).toContain("10:30–15:30");
        expect(state.shifts).toHaveLength(1);
    });

    it("places Sunday closed beside store hours and offers a modeless Planning assistant", () => {
        const state = createInitialPlannerState();
        const html = renderPlannerCalendar(state, null, [], true);

        expect(html).toContain('class="planner-schedule-facts"');
        expect(html).toContain("Sunday closed");
        expect(html).toContain('data-action="toggle-planning-assistant"');
        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain('class="planning-assistant-window"');
        expect(html).toContain('data-assistant-drag-handle');
        expect(html).not.toContain('class="schedule-status"');
    });

    it("opens the day-planning modal alongside the Planning assistant", () => {
        const state = createInitialPlannerState();
        const html = renderPlannerCalendar(state, { type: "add", date: "2026-09-07" }, [], true);

        expect(html).toContain('id="day-planner-dialog"');
        expect(html).toContain('aria-labelledby="day-planner-title"');
        expect(html).toContain('data-day-close');
        expect(html).toContain('Monday, September 7, 2026');
        expect(html).toContain('id="planning-assistant-window"');
        expect(html).not.toContain('id="shift-editor-window"');
    });
});
