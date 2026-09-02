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

export function validateShift(
    state: PlannerState,
    shift: Shift,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    validateShiftTime(
        shift,
        issues,
    );

    validateShiftStoreHours(
        state,
        shift,
        issues,
    );

    validateSaturdayOnlyEmployee(
        state,
        shift,
        issues,
    );

    return issues;
}

export function validatePlannerState(
    state: PlannerState,
): ValidationIssue[] {
    const issues =
        state.shifts.flatMap(
            (shift) =>
                validateShift(
                    state,
                    shift,
                ),
        );

    validateMaximumDaysPerWeek(
        state,
        issues,
    );

    return issues;
}

function validateShiftTime(
    shift: Shift,
    issues: ValidationIssue[],
): void {
    if (
        getShiftDurationMinutes(
            shift,
        ) <= 0
    ) {
        issues.push({
            severity: "error",
            message:
                "Shift end time must be after the start time.",
            employeeId:
                shift.employeeId,
            date:
                shift.date,
        });
    }
}

function validateShiftStoreHours(
    state: PlannerState,
    shift: Shift,
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
                `Shift is outside store hours ` +
                `${state.storeHours.open}–${state.storeHours.close}.`,
            employeeId:
                shift.employeeId,
            date:
                shift.date,
        });
    }
}

function validateSaturdayOnlyEmployee(
    state: PlannerState,
    shift: Shift,
    issues: ValidationIssue[],
): void {
    const employee =
        state.employees.find(
            ({ id }) =>
                id ===
                shift.employeeId,
        );

    if (
        employee?.saturdayOnly &&
        getDayOfWeek(
            shift.date,
        ) !== 6
    ) {
        issues.push({
            severity: "error",
            message:
                `${employee.name} may only be scheduled on Saturday.`,
            employeeId:
                shift.employeeId,
            date:
                shift.date,
        });
    }
}

function validateMaximumDaysPerWeek(
    state: PlannerState,
    issues: ValidationIssue[],
): void {
    const weeks =
        groupShiftsByWeek(
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

        weekShifts.push(
            shift,
        );

        weeks.set(
            weekStart,
            weekShifts,
        );
    }

    return weeks;
}