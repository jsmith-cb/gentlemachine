import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import { validateShift } from "./validationService";
import { availableHoursForDay, hasValidAvailabilityHours } from "./availabilityService";

describe("day-specific availability", () => {
    const availability = {
        days: [1, 2],
        earliestStart: "10:00",
        latestEnd: "18:00",
        dayHours: { 1: { earliestStart: "08:00", latestEnd: "14:00" } },
    };

    it("uses a day's override and falls back to shared hours on other days", () => {
        expect(availableHoursForDay(availability, 1)).toEqual({ earliestStart: "08:00", latestEnd: "14:00" });
        expect(availableHoursForDay(availability, 2)).toEqual({ earliestStart: "10:00", latestEnd: "18:00" });
    });

    it("rejects invalid bounds and overrides on unavailable days", () => {
        expect(hasValidAvailabilityHours(availability)).toBe(true);
        expect(hasValidAvailabilityHours({ ...availability, dayHours: { 1: { earliestStart: "19:00" } } })).toBe(false);
        expect(hasValidAvailabilityHours({ ...availability, dayHours: { 3: { earliestStart: "08:00" } } })).toBe(false);
    });

    it("validates shifts against the relevant day's hours", () => {
        const state = createInitialPlannerState();
        state.employees = [{ ...state.employees[0], availability }];
        expect(validateShift(state, {
            id: "mon", employeeId: "a", date: "2026-09-07", start: "09:00", end: "13:00",
        })).toEqual([]);
        expect(validateShift(state, {
            id: "tue", employeeId: "a", date: "2026-09-08", start: "09:00", end: "13:00",
        }).some((issue) => issue.message.includes("cannot start before 10:00"))).toBe(true);
        expect(validateShift(state, {
            id: "mon-late", employeeId: "a", date: "2026-09-07", start: "09:00", end: "15:00",
        }).some((issue) => issue.message.includes("cannot work after 14:00"))).toBe(true);
        expect(validateShift(state, {
            id: "wed", employeeId: "a", date: "2026-09-09", start: "10:00", end: "13:00",
        }).some((issue) => issue.message.includes("not available on this day"))).toBe(true);
    });
});
