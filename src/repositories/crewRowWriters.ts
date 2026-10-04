import { hasValidAvailabilityHours } from "../services/availabilityService";
import { isValidMaximumPaidMinutesPerDayOverride } from "../services/shiftRules";
import { isValidSoftRuleSettings } from "../services/softRulesService";
import { isValidStoreHours } from "../services/storeHoursService";
import { isValidVacationPeriod } from "../services/vacationService";
import type { Employee, Shift, VacationPeriod } from "../types/planning";
import type { CrewBusinessSettings } from "./CrewRepository";
import { CrewRepositoryError } from "./CrewRepository";

export function employeeToRow(businessId: string, employee: Employee): Record<string, unknown> {
    if (!isUuid(employee.id) || !employee.employeeNumber.trim() || !employee.firstName.trim() ||
        !employee.lastName.trim() || (employee.status !== "active" && employee.status !== "inactive") ||
        !Number.isInteger(employee.weeklyTargetMinutes) || employee.weeklyTargetMinutes < 0 ||
        !Number.isInteger(employee.maxDaysPerWeek) || employee.maxDaysPerWeek < 1 ||
        employee.maxDaysPerWeek > 7 || !isValidAvailability(employee.availability) ||
        (employee.maximumPaidMinutesPerDay !== undefined &&
            !isValidMaximumPaidMinutesPerDayOverride(employee.maximumPaidMinutesPerDay))) {
        invalid("employee");
    }

    return {
        business_id: businessId,
        id: employee.id,
        employee_number: employee.employeeNumber,
        status: employee.status,
        first_name: employee.firstName,
        last_name: employee.lastName,
        email: employee.email ?? null,
        telephone_number: employee.telephoneNumber ?? null,
        weekly_target_minutes: employee.weeklyTargetMinutes,
        maximum_paid_minutes_per_day: employee.maximumPaidMinutesPerDay ?? null,
        max_days_per_week: employee.maxDaysPerWeek,
        availability: structuredClone(employee.availability),
    };
}

export function vacationToRow(
    businessId: string,
    vacation: VacationPeriod,
): Record<string, unknown> {
    if (!isValidVacationPeriod(vacation) || !isUuid(vacation.id) || !isUuid(vacation.employeeId)) {
        invalid("vacation");
    }
    return {
        business_id: businessId,
        id: vacation.id,
        employee_id: vacation.employeeId,
        start_date: vacation.startDate,
        end_date: vacation.endDate,
    };
}

export function shiftToReplacementRow(shift: Shift): Record<string, unknown> {
    if (!shift.id.trim() || !isUuid(shift.employeeId) || !isDateKey(shift.date) ||
        !isMinuteTime(shift.start) || !isMinuteTime(shift.end) || shift.start >= shift.end) {
        invalid("shift");
    }
    return {
        id: shift.id,
        employee_id: shift.employeeId,
        shift_date: shift.date,
        start_time: shift.start,
        end_time: shift.end,
    };
}

export function settingsToRow(
    businessId: string,
    settings: CrewBusinessSettings,
): Record<string, unknown> {
    if (!isValidStoreHours(settings.storeHours) || !isValidSoftRuleSettings(settings.softRules)) {
        invalid("business settings");
    }
    return {
        business_id: businessId,
        store_hours: structuredClone(settings.storeHours),
        soft_rules: structuredClone(settings.softRules),
    };
}

function isValidAvailability(value: Employee["availability"]): boolean {
    return Array.isArray(value.days) && value.days.every((day) =>
        Number.isInteger(day) && day >= 0 && day <= 6) &&
        new Set(value.days).size === value.days.length &&
        hasValidAvailabilityHours(value);
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDateKey(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isMinuteTime(value: string): boolean {
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function invalid(label: string): never {
    throw new CrewRepositoryError(`Cannot persist an invalid ${label}.`);
}
