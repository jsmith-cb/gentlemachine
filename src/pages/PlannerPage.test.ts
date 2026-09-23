import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import {
    generateDraftForEmptyPlanningPeriod,
    planningPeriodHasShifts,
} from "./PlannerPage";

describe("Planner generation integration", () => {
    it("adds generated shifts to the ordinary Planner state without changing employees", () => {
        const state = createInitialPlannerState([
            { id: "prior", employeeId: "a", date: "2026-08-03", start: "10:30", end: "12:30" },
        ]);
        state.selectedYear = 2026;
        state.selectedMonth = 9;
        const employeesBefore = JSON.stringify(state.employees);

        const result = generateDraftForEmptyPlanningPeriod(state);

        expect(result.outcome).toBe("generated");
        expect(result.state.shifts).toContain(state.shifts[0]);
        expect(result.state.shifts.some(({ date }) => date.startsWith("2026-09-"))).toBe(true);
        expect(planningPeriodHasShifts(result.state)).toBe(true);
        expect(JSON.stringify(result.state.employees)).toBe(employeesBefore);
    });

    it("does not replace or modify an existing planning period", () => {
        const existing = {
            id: "existing",
            employeeId: "a",
            date: "2026-09-07",
            start: "10:30",
            end: "12:30",
        };
        const state = createInitialPlannerState([existing]);
        state.selectedYear = 2026;
        state.selectedMonth = 9;

        const result = generateDraftForEmptyPlanningPeriod(state);

        expect(result).toEqual({ state, outcome: "blocked" });
        expect(result.state.shifts).toEqual([existing]);
    });

    it("does not create state when configuration produces no shifts", () => {
        const state = createInitialPlannerState([], []);
        state.selectedYear = 2026;
        state.selectedMonth = 9;

        const result = generateDraftForEmptyPlanningPeriod(state);

        expect(result).toEqual({ state, outcome: "no-result" });
        expect(result.state.shifts).toEqual([]);
    });
});
