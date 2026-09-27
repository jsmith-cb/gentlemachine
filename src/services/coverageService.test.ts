import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import { cloneStoreHours, DEFAULT_STORE_HOURS } from "./storeHoursService";
import { getCoverageGapsForDate } from "./coverageService";

describe("coverage uses authoritative Store Hours", () => {
    it("uses the configured interval and ignores closed days", () => {
        const storeHours = cloneStoreHours(DEFAULT_STORE_HOURS);
        storeHours.days = storeHours.days.map((day) => day.dayOfWeek === 1
            ? { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" }
            : day.dayOfWeek === 3
                ? { dayOfWeek: 3, isOpen: false }
                : day);
        const state = createInitialPlannerState([], undefined, [], storeHours);

        expect(getCoverageGapsForDate(state, "2026-09-21")).toEqual([{
            date: "2026-09-21",
            start: "09:00",
            end: "18:00",
        }]);
        expect(getCoverageGapsForDate(state, "2026-09-23")).toEqual([]);
    });
});

