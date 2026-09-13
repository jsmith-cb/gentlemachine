import type { Shift } from "../types/planning";

export type StorageKey = "shifts";

const STORAGE_KEYS: Record<StorageKey, string> = {
    shifts: "@pp_crew_shifts",
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
