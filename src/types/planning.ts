export interface StoreHours {
    open: string;
    close: string;
}

export interface EmployeeAvailability {
    days: number[];
    earliestStart?: string;
    latestEnd?: string;
}

export interface Employee {
    id: string;
    name: string;
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