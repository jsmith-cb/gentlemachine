import {
    getDayOfWeek,
    getEmployeeDaysWorked,
    getShiftDurationMinutes,
    getWeekStartDate,
    timeToMinutes,
} from "./hoursService";

import type {
    PlannerState,
    Shift,
    ValidationIssue,
} from "../types/planning";

export function validatePlannerState(
    state: PlannerState,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    validateShiftTimes(
        state,
        issues,
    );

    validateStoreHours(
        state,
        issues,
    );

    validateMaximumDaysPerWeek(
        state,
        issues,
    );

    validateSaturdayOnlyEmployees(
        state,
        issues,
    );

    return issues;
}

function validateShiftTimes(
    state: PlannerState,
    issues: ValidationIssue[],
): void {
    for (const shift of state.shifts) {
        if (
            getShiftDurationMinutes(
                shift,
            ) <= 0
        ) {
            issues.push({
                severity: "error",
                message:
                    "Shift end time must be after start time.",
                employeeId:
                    shift.employeeId,
                date: shift.date,
            });
        }
    }
}

function validateStoreHours(
    state: PlannerState,
    issues: ValidationIssue[],
): void {
    const storeOpenMinutes =
        timeToMinutes(
            state.storeHours.open,
        );

    const storeCloseMinutes =
        timeToMinutes(
            state.storeHours.close,
        );

    for (const shift of state.shifts) {
        const shiftStartMinutes =
            timeToMinutes(
                shift.start,
            );

        const shiftEndMinutes =
            timeToMinutes(
                shift.end,
            );

        if (
            shiftStartMinutes <
                storeOpenMinutes ||
            shiftEndMinutes >
                storeCloseMinutes
        ) {
            issues.push({
                severity: "warning",
                message:
                    `Shift falls outside store hours ` +
                    `${state.storeHours.open}–${state.storeHours.close}.`,
                employeeId:
                    shift.employeeId,
                date: shift.date,
            });
        }
    }
}

function validateMaximumDaysPerWeek(
    state: PlannerState,
    issues: ValidationIssue[],
): void {
    const weeks = groupShiftsByWeek(
        state.shifts,
    );

    for (
        const [
            weekStart,
            weekShifts,
        ] of weeks
    ) {
        for (
            const employee
            of state.employees
        ) {
            const daysWorked =
                getEmployeeDaysWorked(
                    employee.id,
                    weekShifts,
                );

            if (
                daysWorked >
                employee.maxDaysPerWeek
            ) {
                issues.push({
                    severity: "error",
                    message:
                        `${employee.name} is scheduled ` +
                        `${daysWorked} days during the week ` +
                        `starting ${weekStart}. Maximum is ` +
                        `${employee.maxDaysPerWeek}.`,
                    employeeId:
                        employee.id,
                });
            }
        }
    }
}

function validateSaturdayOnlyEmployees(
    state: PlannerState,
    issues: ValidationIssue[],
): void {
    const saturdayOnlyEmployeeIds =
        new Set(
            state.employees
                .filter(
                    (employee) =>
                        employee.saturdayOnly,
                )
                .map(
                    (employee) =>
                        employee.id,
                ),
        );

    for (const shift of state.shifts) {
        if (
            saturdayOnlyEmployeeIds.has(
                shift.employeeId,
            ) &&
            getDayOfWeek(
                shift.date,
            ) !== 6
        ) {
            const employee =
                state.employees.find(
                    ({ id }) =>
                        id ===
                        shift.employeeId,
                );

            issues.push({
                severity: "error",
                message:
                    `${employee?.name ?? "Employee"} ` +
                    "may only be scheduled on Saturday.",
                employeeId:
                    shift.employeeId,
                date: shift.date,
            });
        }
    }
}

function groupShiftsByWeek(
    shifts: Shift[],
): Map<string, Shift[]> {
    const weeks =
        new Map<string, Shift[]>();

    for (const shift of shifts) {
        const weekStart =
            getWeekStartDate(
                shift.date,
            );

        const weekShifts =
            weeks.get(
                weekStart,
            ) ?? [];

        weekShifts.push(shift);

        weeks.set(
            weekStart,
            weekShifts,
        );
    }

    return weeks;
}