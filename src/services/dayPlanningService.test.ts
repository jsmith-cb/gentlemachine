import { describe, expect, it } from "vitest";
import { applyDayPlanningChanges, availableTeamForDay } from "./dayPlanningService";
import { createInitialPlannerState } from "../state/plannerState";

describe("day planning availability", () => {
    it("uses day-specific hours and excludes vacation and inactive team members", () => {
        const state = createInitialPlannerState([], undefined, []);
        const employee = state.employees[0]!;
        state.employees = [
            { ...employee, id: "available", availability: { days: [1], dayHours: { 1: { earliestStart: "12:00", latestEnd: "18:00" } } } },
            { ...employee, id: "vacation", availability: { days: [1] } },
            { ...employee, id: "inactive", status: "inactive", availability: { days: [1] } },
        ];
        state.vacations = [{ id: "v", employeeId: "vacation", startDate: "2026-09-21", endDate: "2026-09-21" }];
        expect(availableTeamForDay(state, "2026-09-21").map(({ employee, start, end }) =>
            [employee.id, start, end])).toEqual([["available", "12:00", "18:00"]]);
    });
});

describe("saving a day plan", () => {
    it("commits multiple drafts and edits together while retaining other days", () => {
        const original = { id: "one", employeeId: "a", date: "2026-09-21", start: "10:30", end: "12:30" };
        const otherDay = { ...original, id: "other-day", date: "2026-09-22" };
        const updated = { ...original, end: "13:00" };
        const added = { ...original, id: "two", employeeId: "b", start: "12:00", end: "18:00" };
        expect(applyDayPlanningChanges([original, otherDay], [updated, added], []))
            .toEqual([updated, otherDay, added]);
        expect(original.end).toBe("12:30");
    });

    it("applies staged removals in the same batch", () => {
        const removed = { id: "one", employeeId: "a", date: "2026-09-21", start: "10:30", end: "12:30" };
        const added = { ...removed, id: "two" };
        expect(applyDayPlanningChanges([removed], [added], ["one"])).toEqual([added]);
    });
});
