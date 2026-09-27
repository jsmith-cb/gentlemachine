import { describe, expect, it } from "vitest";
import { applyDayPlanningChanges, availableTeamForDay } from "./dayPlanningService";
import { createInitialPlannerState } from "../state/plannerState";
import { cloneStoreHours, DEFAULT_STORE_HOURS } from "./storeHoursService";
import { validateShift } from "./validationService";

describe("day planning availability", () => {
    it("uses legal default hours and excludes vacation and inactive team members", () => {
        const state = createInitialPlannerState([], undefined, []);
        const employee = state.employees[0]!;
        state.employees = [
            { ...employee, id: "available", availability: { days: [1], dayHours: { 1: { earliestStart: "12:00", latestEnd: "18:00" } } } },
            { ...employee, id: "vacation", availability: { days: [1] } },
            { ...employee, id: "inactive", status: "inactive", availability: { days: [1] } },
        ];
        state.vacations = [{ id: "v", employeeId: "vacation", startDate: "2026-09-21", endDate: "2026-09-21" }];
        expect(availableTeamForDay(state, "2026-09-21").map(({ employee, start, end }) =>
            [employee.id, start, end])).toEqual([["available", "10:30", "20:30"]]);
    });

    it("uses changed operating hours and excludes a closed weekday", () => {
        const storeHours = cloneStoreHours(DEFAULT_STORE_HOURS);
        storeHours.days = storeHours.days.map((day) => day.dayOfWeek === 1
            ? { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" }
            : day.dayOfWeek === 3
                ? { dayOfWeek: 3, isOpen: false }
                : day);
        const state = createInitialPlannerState([], undefined, [], storeHours);

        expect(availableTeamForDay(state, "2026-09-21")[0]).toMatchObject({
            start: "09:00",
            end: "18:00",
        });
        expect(availableTeamForDay(state, "2026-09-23")).toEqual([]);
    });
});

describe("saving a day plan", () => {
    it("exposes the shared daily paid-hours error for a staged multi-shift plan", () => {
        const state = createInitialPlannerState();
        state.employees = [{
            ...state.employees[0]!, maximumPaidMinutesPerDay: 6 * 60,
        }];
        const first = {
            id: "first", employeeId: "a", date: "2026-09-21",
            start: "10:30", end: "14:30",
        };
        const second = {
            id: "second", employeeId: "a", date: "2026-09-21",
            start: "15:00", end: "18:00",
        };
        const projected = applyDayPlanningChanges([], [first, second], []);

        expect(validateShift({ ...state, shifts: projected }, second)).toContainEqual(
            expect.objectContaining({
                severity: "error", category: "hours",
                message: expect.stringContaining("Maximum is 6:00"),
            }),
        );
    });

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
