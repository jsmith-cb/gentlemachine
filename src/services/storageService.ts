import type { Shift, Employee, VacationPeriod, StoreHours, SoftRuleSettings } from "../types/planning";
import { isValidVacationPeriod } from "./vacationService";
import { hasValidAvailabilityHours } from "./availabilityService";
import { cloneStoreHours, DEFAULT_STORE_HOURS, isValidStoreHours } from "./storeHoursService";
import {
    cloneSoftRuleSettings, DEFAULT_SOFT_RULE_SETTINGS, isValidSoftRuleSettings,
} from "./softRulesService";
import { isValidMaximumPaidMinutesPerDayOverride } from "./shiftRules";

export type StorageKey = "shifts" | "employees" | "vacations" | "storeHours" | "softRules";

const STORAGE_KEYS: Record<StorageKey, string> = {
    shifts: "@pp_crew_shifts",
    employees: "@pp_crew_employees",
    vacations: "@pp_crew_vacations",
    storeHours: "@pp_crew_store_hours",
    softRules: "@pp_crew_soft_rules",
};

export function getStoredSoftRuleSettings(): SoftRuleSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.softRules);
        if (!raw) return cloneSoftRuleSettings(DEFAULT_SOFT_RULE_SETTINGS);
        const parsed: unknown = JSON.parse(raw);
        return isValidSoftRuleSettings(parsed)
            ? cloneSoftRuleSettings(parsed)
            : cloneSoftRuleSettings(DEFAULT_SOFT_RULE_SETTINGS);
    } catch {
        return cloneSoftRuleSettings(DEFAULT_SOFT_RULE_SETTINGS);
    }
}

export function setStoredSoftRuleSettings(settings: SoftRuleSettings): void {
    if (!isValidSoftRuleSettings(settings)) throw new Error("Invalid Soft Rules configuration.");
    try {
        localStorage.setItem(STORAGE_KEYS.softRules, JSON.stringify(settings));
    } catch {
        // Match the existing local-storage persistence behavior.
    }
}

export function getStoredStoreHours(): StoreHours {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.storeHours);
        if (!raw) return cloneStoreHours(DEFAULT_STORE_HOURS);
        const parsed: unknown = JSON.parse(raw);
        return isValidStoreHours(parsed)
            ? cloneStoreHours(parsed)
            : cloneStoreHours(DEFAULT_STORE_HOURS);
    } catch {
        return cloneStoreHours(DEFAULT_STORE_HOURS);
    }
}

export function setStoredStoreHours(storeHours: StoreHours): void {
    if (!isValidStoreHours(storeHours)) throw new Error("Invalid Store Hours configuration.");
    try {
        localStorage.setItem(STORAGE_KEYS.storeHours, JSON.stringify(storeHours));
    } catch {
        // Match the existing local-storage persistence behavior.
    }
}

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
                (item.maximumPaidMinutesPerDay === undefined ||
                    isValidMaximumPaidMinutesPerDayOverride(
                        item.maximumPaidMinutesPerDay,
                    )) &&
                Number.isInteger(item.maxDaysPerWeek) &&
                item.maxDaysPerWeek >= 1 &&
                item.maxDaysPerWeek <= 7 &&
                typeof item.availability === "object" &&
                null !== item.availability &&
                Array.isArray(item.availability.days) &&
                item.availability.days.every((d: number) => Number.isInteger(d) && d >= 0 && d <= 6);

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
