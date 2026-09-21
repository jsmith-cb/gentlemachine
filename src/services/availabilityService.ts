import type { EmployeeAvailability } from "../types/planning";

const TIME_PATTERN = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

export function isValidTime(value: string): boolean {
    return TIME_PATTERN.test(value);
}

export function availableHoursForDay(
    availability: EmployeeAvailability,
    day: number,
): { earliestStart?: string; latestEnd?: string } {
    const override = availability.dayHours?.[day];
    return {
        earliestStart: override?.earliestStart ?? availability.earliestStart,
        latestEnd: override?.latestEnd ?? availability.latestEnd,
    };
}

export function hasValidAvailabilityHours(availability: EmployeeAvailability): boolean {
    if (availability.earliestStart !== undefined &&
        (typeof availability.earliestStart !== "string" || !isValidTime(availability.earliestStart))) return false;
    if (availability.latestEnd !== undefined &&
        (typeof availability.latestEnd !== "string" || !isValidTime(availability.latestEnd))) return false;
    if (availability.earliestStart && availability.latestEnd &&
        availability.earliestStart >= availability.latestEnd) return false;
    if (availability.dayHours !== undefined) {
        if (!availability.dayHours || Array.isArray(availability.dayHours) || typeof availability.dayHours !== "object") return false;
        for (const [dayText, hours] of Object.entries(availability.dayHours)) {
            const day = Number(dayText);
            if (!Number.isInteger(day) || String(day) !== dayText || !availability.days.includes(day) ||
                !hours || Array.isArray(hours) || typeof hours !== "object") return false;
            if (hours.earliestStart !== undefined && (typeof hours.earliestStart !== "string" || !isValidTime(hours.earliestStart))) return false;
            if (hours.latestEnd !== undefined && (typeof hours.latestEnd !== "string" || !isValidTime(hours.latestEnd))) return false;
        }
    }
    return availability.days.every((day) => {
        const { earliestStart, latestEnd } = availableHoursForDay(availability, day);
        return !earliestStart || !latestEnd || earliestStart < latestEnd;
    });
}
