import { describe, expect, it } from "vitest";
import {
    cloneStoreHours,
    DEFAULT_STORE_HOURS,
    getOpenOperatingDays,
    getOperatingHoursForDate,
    isValidStoreHours,
} from "./storeHoursService";

describe("Store Hours domain", () => {
    it("preserves the existing Mon–Sat 10:30–20:30 default and closes Sunday", () => {
        expect(getOpenOperatingDays(DEFAULT_STORE_HOURS)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(getOperatingHoursForDate(DEFAULT_STORE_HOURS, "2026-09-21"))
            .toEqual({ open: "10:30", close: "20:30" });
        expect(getOperatingHoursForDate(DEFAULT_STORE_HOURS, "2026-09-27")).toBeNull();
    });

    it("accepts a complete valid configuration and rejects invalid intervals", () => {
        expect(isValidStoreHours(DEFAULT_STORE_HOURS)).toBe(true);
        const invalid = cloneStoreHours(DEFAULT_STORE_HOURS);
        invalid.days = invalid.days.map((day) => day.dayOfWeek === 1
            ? { dayOfWeek: 1, isOpen: true, openTime: "18:00", closeTime: "09:00" }
            : day);
        expect(isValidStoreHours(invalid)).toBe(false);
    });

    it("treats a closed day as having no operating interval", () => {
        const changed = cloneStoreHours(DEFAULT_STORE_HOURS);
        changed.days = changed.days.map((day) => day.dayOfWeek === 3
            ? { dayOfWeek: 3, isOpen: false }
            : day);
        expect(getOpenOperatingDays(changed)).toEqual([1, 2, 4, 5, 6]);
        expect(getOperatingHoursForDate(changed, "2026-09-23")).toBeNull();
    });
});

