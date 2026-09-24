export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type StoreOperatingDay = {
    dayOfWeek: Weekday;
    isOpen: true;
    openTime: string;
    closeTime: string;
} | {
    dayOfWeek: Weekday;
    isOpen: false;
};

export interface StoreHours {
    days: StoreOperatingDay[];
}

export interface EmployeeAvailability {
    days: number[];
    earliestStart?: string;
    latestEnd?: string;
    dayHours?: Record<number, {
        earliestStart?: string;
        latestEnd?: string;
    }>;
}

export interface Employee {
    /** Immutable Crew-owned identity referenced by shifts and vacations. */
    id: string;
    /** Merchant-facing identifier; never used as a domain reference. */
    employeeNumber: string;
    status: "active" | "inactive";
    firstName: string;
    lastName: string;
    email?: string;
    telephoneNumber?: string;
    weeklyTargetMinutes: number;
    maxDaysPerWeek: number;
    availability: EmployeeAvailability;
}

export interface Shift {
    id: string;
    employeeId: string;
    date: string;
    start: string;
    end: string;
}

export interface VacationPeriod {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
}

export interface BreakRule {
    minimumShiftMinutes: number;
    breakMinutes: number;
}

export interface PlannerState {
    selectedYear: number;
    selectedMonth: number;
    storeHours: StoreHours;
    employees: Employee[];
    shifts: Shift[];
    vacations: VacationPeriod[];
}

export interface EmployeeMonthSummary {
    employeeId: string;
    scheduledMinutes: number;
    daysWorked: number;
    saturdaysWorked: number;
}

export interface EmployeeWeekSummary {
    employeeId: string;
    weekStart: string;
    weekEnd: string;
    scheduledMinutes: number;
    targetMinutes: number;
    differenceMinutes: number;
    daysWorked: number;
    partialMonthWeek: boolean;
}

export interface CoverageGap {
    date: string;
    start: string;
    end: string;
}

export type ValidationSeverity =
    | "error"
    | "warning";

export type ValidationCategory =
    | "shift"
    | "availability"
    | "coverage"
    | "hours";

export interface ValidationIssue {
    severity: ValidationSeverity;
    category: ValidationCategory;
    message: string;
    employeeId?: string;
    date?: string;
}
