export interface StoreHours {
    open: string;
    close: string;
}

export interface Employee {
    id: string;
    name: string;
    weeklyTargetMinutes: number;
    maxDaysPerWeek: number;
    saturdayOnly: boolean;
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

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
    severity: ValidationSeverity;
    message: string;
    employeeId?: string;
    date?: string;
}