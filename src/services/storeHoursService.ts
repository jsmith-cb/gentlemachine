import { isValidTime } from "./availabilityService";

import type { StoreHours, StoreOperatingDay, Weekday } from "../types/planning";

export const DEFAULT_STORE_HOURS: StoreHours = {
    days: [
        { dayOfWeek: 1, isOpen: true, openTime: "10:30", closeTime: "20:30" },
        { dayOfWeek: 2, isOpen: true, openTime: "10:30", closeTime: "20:30" },
        { dayOfWeek: 3, isOpen: true, openTime: "10:30", closeTime: "20:30" },
        { dayOfWeek: 4, isOpen: true, openTime: "10:30", closeTime: "20:30" },
        { dayOfWeek: 5, isOpen: true, openTime: "10:30", closeTime: "20:30" },
        { dayOfWeek: 6, isOpen: true, openTime: "10:30", closeTime: "20:30" },
        { dayOfWeek: 0, isOpen: false },
    ],
};

export function isValidStoreHours(value: unknown): value is StoreHours {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        !("days" in value) || !Array.isArray(value.days) || value.days.length !== 7) return false;
    const seen = new Set<number>();
    for (const candidate of value.days) {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
        const day = candidate as Record<string, unknown>;
        if (!Number.isInteger(day.dayOfWeek) || Number(day.dayOfWeek) < 0 ||
            Number(day.dayOfWeek) > 6 || seen.has(Number(day.dayOfWeek)) ||
            typeof day.isOpen !== "boolean") return false;
        seen.add(Number(day.dayOfWeek));
        if (day.isOpen) {
            if (typeof day.openTime !== "string" || typeof day.closeTime !== "string" ||
                !isValidTime(day.openTime) || !isValidTime(day.closeTime) ||
                day.openTime >= day.closeTime) return false;
        } else if (day.openTime !== undefined || day.closeTime !== undefined) {
            return false;
        }
    }
    return seen.size === 7;
}

export function getOperatingDay(
    storeHours: StoreHours,
    dayOfWeek: number,
): StoreOperatingDay | null {
    return storeHours.days.find((day) => day.dayOfWeek === dayOfWeek) ?? null;
}

export function getOperatingHoursForDate(
    storeHours: StoreHours,
    date: string,
): { open: string; close: string } | null {
    const [year, month, dayOfMonth] = date.split("-").map(Number);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();
    const day = getOperatingDay(storeHours, dayOfWeek);
    return day?.isOpen ? { open: day.openTime, close: day.closeTime } : null;
}

export function getOpenOperatingDays(storeHours: StoreHours): Weekday[] {
    return storeHours.days
        .filter((day): day is Extract<StoreOperatingDay, { isOpen: true }> => day.isOpen)
        .map(({ dayOfWeek }) => dayOfWeek)
        .sort((left, right) => ((left + 6) % 7) - ((right + 6) % 7));
}

export function cloneStoreHours(storeHours: StoreHours): StoreHours {
    return { days: storeHours.days.map((day) => ({ ...day })) };
}
