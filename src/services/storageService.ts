import type { Shift, Employee } from "../types/planning";

export type StorageKey = "shifts" | "employees";

export const STORAGE_KEYS: Record<StorageKey, string> = {
    shifts: "@pp_crew_shifts",
    employees: "@pp_crew_employees",
};

export function getStoredShifts(): Shift[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.shifts);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);

        // Reject non-arrays entirely (fail fast, no partial recovery)
        if (!Array.isArray(parsed)) {
            return [];
        }

        // Validate all entries — reject list if any entry is malformed
        for (const item of parsed) {
            const valid =
                typeof item === "object" &&
                !Array.isArray(item) &&
                null !== item &&
                typeof item.id === "string" &&
                null !== item.id &&
                typeof item.employeeId === "string" &&
                null !== item.employeeId &&
                typeof item.date === "string" &&
                null !== item.date &&
                typeof item.start === "string" &&
                null !== item.start &&
                typeof item.end === "string" &&
                null !== item.end;

            if (!valid) {
                return [];
            }
        }

        // All entries valid — accept the entire list
        return parsed as Shift[];
    } catch {
        // Malformed JSON or any other error — fallback to empty list
        return [];
    }
}

export function setStoredShifts(shifts: Shift[]): void {
    try {
        localStorage.setItem(
            STORAGE_KEYS.shifts,
            JSON.stringify(shifts),
        );
    } catch {
        // Storage quota exceeded or write error — silently ignore
        // Do not prevent the application from working
    }
}

export function getStoredEmployees(): Employee[] | undefined {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.employees);

        if (!raw) {
            return undefined;
        }

        const parsed = JSON.parse(raw);

        // Reject non-arrays entirely (fail fast, no partial recovery)
        if (!Array.isArray(parsed)) {
            return undefined;
        }

        // Treat an empty persisted employee array as unusable configuration
        if (parsed.length === 0) {
            return undefined;
        }

        // Validate all entries — reject list if any entry is malformed
        for (const item of parsed) {
            const valid =
                typeof item === "object" &&
                !Array.isArray(item) &&
                null !== item &&
                typeof item.id === "string" &&
                item.id.trim() !== "" &&
                typeof item.name === "string" &&
                item.name.trim() !== "" &&
                Number.isFinite(item.weeklyTargetMinutes) &&
                item.weeklyTargetMinutes >= 0 &&
                Number.isInteger(item.maxDaysPerWeek) &&
                item.maxDaysPerWeek >= 1 &&
                item.maxDaysPerWeek <= 7 &&
                typeof item.availability === "object" &&
                null !== item.availability &&
                Array.isArray(item.availability.days) &&
                item.availability.days.every((d: number) => Number.isInteger(d) && d >= 1 && d <= 7);

            if (!valid) {
                return undefined;
            }

            // Validate HH:mm format and values for optional fields
            if (item.availability.earliestStart !== undefined) {
                if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(item.availability.earliestStart)) {
                    return undefined;
                }
            }

            if (item.availability.latestEnd !== undefined) {
                if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(item.availability.latestEnd)) {
                    return undefined;
                }
            }
        }

        // All entries valid — accept the entire list
        return parsed as Employee[];
    } catch {
        // Malformed JSON or any other error — fallback to defaults
        return undefined;
    }
}

export function setStoredEmployees(employees: Employee[]): void {
    try {
        localStorage.setItem(
            STORAGE_KEYS.employees,
            JSON.stringify(employees),
        );
    } catch {
        // Storage quota exceeded or write error — silently ignore
        // Do not prevent the application from working
    }
}
