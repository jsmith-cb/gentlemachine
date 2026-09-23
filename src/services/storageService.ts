import type { Shift, Employee, VacationPeriod } from "../types/planning";
import { isValidVacationPeriod } from "./vacationService";
import { hasValidAvailabilityHours } from "./availabilityService";

export type StorageKey = "shifts" | "employees" | "vacations";

const STORAGE_KEYS: Record<StorageKey, string> = {
    shifts: "@pp_crew_shifts",
    employees: "@pp_crew_employees",
    vacations: "@pp_crew_vacations",
};

export function getStoredVacations(): VacationPeriod[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.vacations);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.every(isValidVacationPeriod)
            ? parsed
            : [];
    } catch {
        return [];
    }
}

export function setStoredVacations(vacations: VacationPeriod[]): void {
    try {
        localStorage.setItem(STORAGE_KEYS.vacations, JSON.stringify(vacations));
    } catch {
        // Match the existing local-storage persistence behavior.
    }
}

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
                (item.employeeNumber === undefined || typeof item.employeeNumber === "string") &&
                (item.status === undefined || item.status === "active" || item.status === "inactive") &&
                typeof item.firstName === "string" &&
                item.firstName.trim() !== "" &&
                typeof item.lastName === "string" &&
                item.lastName.trim() !== "" &&
                (item.email === undefined || typeof item.email === "string") &&
                (item.telephoneNumber === undefined || typeof item.telephoneNumber === "string") &&
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

            if (!hasValidAvailabilityHours(item.availability)) return undefined;
        }

        const ids = new Set(parsed.map((item) => item.id));
        if (ids.size !== parsed.length) return undefined;

        // Preserve existing internal IDs so stored shifts and vacations still resolve.
        // The former editable ID becomes the merchant-facing employee number.
        const employees: Employee[] = parsed.map((item) => ({
            ...item,
            employeeNumber: item.employeeNumber ?? item.id,
            status: item.status ?? "active",
        }));
        if (parsed.some((item) => item.employeeNumber === undefined || item.status === undefined)) {
            setStoredEmployees(employees);
        }
        return employees;
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
