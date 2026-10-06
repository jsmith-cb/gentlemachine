import { hasValidAvailabilityHours, isValidTime } from "../services/availabilityService";
import { isValidMaximumPaidMinutesPerDayOverride } from "../services/shiftRules";
import { isValidSchedulingRuleSettings } from "../services/schedulingRulesService";
import { isValidStoreHours } from "../services/storeHoursService";
import type {
    Employee,
    EmployeeAvailability,
    Shift,
    SicknessPeriod,
    VacationPeriod,
} from "../types/planning";
import type { CrewWorkspaceData } from "./CrewRepository";
import { CrewRepositoryError } from "./CrewRepository";

export interface CanonicalWorkspaceRows {
    readonly business: unknown;
    readonly employees: unknown;
    readonly shifts: unknown;
    readonly vacations: unknown;
    readonly sicknesses: unknown;
    readonly settings: unknown;
}

export function mapCanonicalWorkspaceRows(
    businessId: string,
    rows: CanonicalWorkspaceRows,
): CrewWorkspaceData {
    const workspace = mapWorkspace(businessId, rows.business);
    const employees = requireArray(rows.employees, "employees")
        .map((row, index) => mapEmployee(businessId, row, index));
    const employeeIds = new Set(employees.map(({ id }) => id));
    if (employeeIds.size !== employees.length) fail("employees contain duplicate identities");

    const shifts = requireArray(rows.shifts, "shifts")
        .map((row, index) => mapShift(businessId, row, index));
    ensureUnique(shifts.map(({ id }) => id), "shifts");
    ensureEmployeeReferences(shifts, employeeIds, "shifts");

    const vacations = requireArray(rows.vacations, "vacations")
        .map((row, index) => mapVacation(businessId, row, index));
    ensureUnique(vacations.map(({ id }) => id), "vacations");
    ensureEmployeeReferences(vacations, employeeIds, "vacations");
    const sicknesses = requireArray(rows.sicknesses, "sicknesses")
        .map((row, index) => mapSickness(businessId, row, index));
    ensureUnique(sicknesses.map(({ id }) => id), "sicknesses");
    ensureEmployeeReferences(sicknesses, employeeIds, "sicknesses");

    const settings = requireRecord(rows.settings, "business_settings");
    requireBusinessScope(businessId, settings, "business_settings");
    if (!isValidStoreHours(settings.store_hours)) {
        fail("business_settings.store_hours is not valid Store Hours data");
    }
    if (!isValidSchedulingRuleSettings(settings.scheduling_rules)) {
        fail("business_settings.scheduling_rules is not valid Scheduling Rules data");
    }

    return {
        workspace,
        employees,
        shifts,
        vacations,
        sicknesses,
        settings: {
            storeHours: structuredClone(settings.store_hours),
            schedulingRules: structuredClone(settings.scheduling_rules),
        },
    };
}

function mapWorkspace(businessId: string, value: unknown): CrewWorkspaceData["workspace"] {
    const row = requireRecord(value, "business");
    if (row.id !== businessId) fail("business identity does not match the authorized workspace");
    if (!isNonEmptyString(row.name)) fail("business.name must be a non-empty string");
    return { id: businessId, name: row.name };
}

function mapEmployee(businessId: string, value: unknown, index: number): Employee {
    const path = `employees[${index}]`;
    const row = requireRecord(value, path);
    requireBusinessScope(businessId, row, path);
    if (!isNonEmptyString(row.id) || !isNonEmptyString(row.employee_number) ||
        !isNonEmptyString(row.first_name) || !isNonEmptyString(row.last_name)) {
        fail(`${path} has invalid identity or name fields`);
    }
    if (row.status !== "active" && row.status !== "inactive") fail(`${path}.status is invalid`);
    if (!isIntegerAtLeast(row.weekly_target_minutes, 0)) fail(`${path}.weekly_target_minutes is invalid`);
    if (!isIntegerBetween(row.max_days_per_week, 1, 7)) fail(`${path}.max_days_per_week is invalid`);
    if (row.maximum_paid_minutes_per_day !== null &&
        !isValidMaximumPaidMinutesPerDayOverride(row.maximum_paid_minutes_per_day)) {
        fail(`${path}.maximum_paid_minutes_per_day is invalid`);
    }
    if (row.email !== null && typeof row.email !== "string") fail(`${path}.email is invalid`);
    if (row.telephone_number !== null && typeof row.telephone_number !== "string") {
        fail(`${path}.telephone_number is invalid`);
    }

    const availability = mapAvailability(row.availability, `${path}.availability`);
    return {
        id: row.id,
        employeeNumber: row.employee_number,
        status: row.status,
        firstName: row.first_name,
        lastName: row.last_name,
        ...(row.email === null ? {} : { email: row.email }),
        ...(row.telephone_number === null ? {} : { telephoneNumber: row.telephone_number }),
        weeklyTargetMinutes: row.weekly_target_minutes,
        ...(row.maximum_paid_minutes_per_day === null
            ? {}
            : { maximumPaidMinutesPerDay: row.maximum_paid_minutes_per_day }),
        maxDaysPerWeek: row.max_days_per_week,
        availability,
    };
}

function mapAvailability(value: unknown, path: string): EmployeeAvailability {
    const row = requireRecord(value, path);
    if (!Array.isArray(row.days) || !row.days.every((day) =>
        isIntegerBetween(day, 0, 6)) || new Set(row.days).size !== row.days.length) {
        fail(`${path}.days is invalid`);
    }
    const availability = structuredClone(row) as unknown as EmployeeAvailability;
    if (!hasValidAvailabilityHours(availability)) fail(`${path} contains invalid hours`);
    return availability;
}

function mapShift(businessId: string, value: unknown, index: number): Shift {
    const path = `shifts[${index}]`;
    const row = requireRecord(value, path);
    requireBusinessScope(businessId, row, path);
    if (!isNonEmptyString(row.id) || !isNonEmptyString(row.employee_id)) {
        fail(`${path} has invalid identity fields`);
    }
    if (!isDateKey(row.shift_date)) fail(`${path}.shift_date is invalid`);
    const start = mapDatabaseTime(row.start_time, `${path}.start_time`);
    const end = mapDatabaseTime(row.end_time, `${path}.end_time`);
    if (start >= end) fail(`${path} must end after it starts`);
    return { id: row.id, employeeId: row.employee_id, date: row.shift_date, start, end };
}

function mapVacation(businessId: string, value: unknown, index: number): VacationPeriod {
    const path = `vacations[${index}]`;
    const row = requireRecord(value, path);
    requireBusinessScope(businessId, row, path);
    if (!isNonEmptyString(row.id) || !isNonEmptyString(row.employee_id)) {
        fail(`${path} has invalid identity fields`);
    }
    if (!isDateKey(row.start_date) || !isDateKey(row.end_date) || row.start_date > row.end_date) {
        fail(`${path} has an invalid date range`);
    }
    return {
        id: row.id,
        employeeId: row.employee_id,
        startDate: row.start_date,
        endDate: row.end_date,
    };
}

function mapSickness(businessId: string, value: unknown, index: number): SicknessPeriod {
    const path = `sicknesses[${index}]`;
    const row = requireRecord(value, path);
    requireBusinessScope(businessId, row, path);
    if (!isNonEmptyString(row.id) || !isNonEmptyString(row.employee_id) ||
        !isDateKey(row.start_date) || !isDateKey(row.end_date) || row.start_date > row.end_date) {
        fail(`${path} is invalid`);
    }
    return { id: row.id, employeeId: row.employee_id, startDate: row.start_date, endDate: row.end_date };
}

function mapDatabaseTime(value: unknown, path: string): string {
    if (typeof value !== "string") fail(`${path} is invalid`);
    const match = /^(\d{2}:\d{2})(?::00(?:\.0+)?)?$/.exec(value);
    if (!match || !isValidTime(match[1])) fail(`${path} is not minute-aligned`);
    return match[1];
}

function requireBusinessScope(
    businessId: string,
    row: Record<string, unknown>,
    path: string,
): void {
    if (row.business_id !== businessId) fail(`${path} is outside the authorized workspace`);
}

function ensureEmployeeReferences(
    records: readonly { employeeId: string }[],
    employeeIds: ReadonlySet<string>,
    label: string,
): void {
    if (records.some(({ employeeId }) => !employeeIds.has(employeeId))) {
        fail(`${label} reference an employee outside the canonical employee collection`);
    }
}

function ensureUnique(values: readonly string[], label: string): void {
    if (new Set(values).size !== values.length) fail(`${label} contain duplicate identities`);
}

function requireArray(value: unknown, path: string): unknown[] {
    if (!Array.isArray(value)) fail(`${path} must be an array`);
    return value;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        fail(`${path} must be an object`);
    }
    return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim() !== "";
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
    return Number.isInteger(value) && Number(value) >= minimum;
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
    return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function isDateKey(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function fail(message: string): never {
    throw new CrewRepositoryError(`Canonical Crew data is invalid: ${message}.`);
}
