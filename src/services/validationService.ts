import {
    getDayOfWeek,
    getEmployeeDaysWorked,
    getEmployeeWeekSummaries,
    getMonthShifts,
    getShiftDurationMinutes,
    getWeekStartDate,
    isDateInMonth,
    timeToMinutes,
} from "./hoursService";

import {
    getCoverageGapsForMonth,
} from "./coverageService";

import type {
    PlannerState,
    Shift,
    ValidationIssue,
} from "../types/planning";

export function validateShift(
    state: PlannerState,
    shift: Shift,
): ValidationIssue[] {
    const issues:
        ValidationIssue[] = [];

    validateShiftTime(
        shift,
        issues,
    );

    validateEmployeeAvailability(
        state,
        shift,
        issues,
    );

    return issues;
}

export function validatePlannerState(
    state: PlannerState,
): ValidationIssue[] {
    const monthShifts =
        getMonthShifts(
            state.shifts,
            state.selectedYear,
            state.selectedMonth,
        );

    const issues =
        monthShifts.flatMap(
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

    validateWeeklyTargets(
        state,
        issues,
    );

    validateCoverage(
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

function validateEmployeeAvailability(
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

    if (!employee) {
        issues.push({
            severity: "error",
            message:
                "Shift references an unknown employee.",
            employeeId:
                shift.employeeId,
            date:
                shift.date,
        });

        return;
    }

    const dayOfWeek =
        getDayOfWeek(
            shift.date,
        );

    if (
        !employee.availability.days.includes(
            dayOfWeek,
        )
    ) {
        issues.push({
            severity: "error",
            message:
                `${employee.name} is not available on this day.`,
            employeeId:
                employee.id,
            date:
                shift.date,
        });
    }

    const earliestStart =
        employee.availability
            .earliestStart;

    if (
        earliestStart &&
        timeToMinutes(
            shift.start,
        ) <
            timeToMinutes(
                earliestStart,
            )
    ) {
        issues.push({
            severity: "error",
            message:
                `${employee.name} cannot start before ${earliestStart}.`,
            employeeId:
                employee.id,
            date:
                shift.date,
        });
    }

    const latestEnd =
        employee.availability
            .latestEnd;

    if (
        latestEnd &&
        timeToMinutes(
            shift.end,
        ) >
            timeToMinutes(
                latestEnd,
            )
    ) {
        issues.push({
            severity: "error",
            message:
                `${employee.name} cannot work after ${latestEnd}.`,
            employeeId:
                employee.id,
            date:
                shift.date,
        });
    }
}

function validateMaximumDaysPerWeek(
    state: PlannerState,
    issues: ValidationIssue[],
): void {
    const relevantShifts =
        state.shifts.filter(
            (shift) =>
                weekIntersectsSelectedMonth(
                    shift.date,
                    state,
                ),
        );

    const weeks =
        groupShiftsByWeek(
            relevantShifts,
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
                        `${employee.name} works ${daysWorked} days ` +
                        `during the week starting ${weekStart}. ` +
                        `Maximum is ${employee.maxDaysPerWeek}.`,
                    employeeId:
                        employee.id,
                });
            }
        }
    }
}

function validateWeeklyTargets(
    state: PlannerState,
    issues: ValidationIssue[],
): void {
    const summaries =
        getEmployeeWeekSummaries(
            state,
        );

    for (
        const summary
        of summaries
    ) {
        if (
            summary.partialMonthWeek
        ) {
            continue;
        }

        const employee =
            state.employees.find(
                ({ id }) =>
                    id ===
                    summary.employeeId,
            );

        if (
            !employee ||
            isSingleDayEmployee(
                employee.availability.days,
            )
        ) {
            continue;
        }

        if (
            summary.differenceMinutes ===
            0
        ) {
            continue;
        }

        const direction =
            summary.differenceMinutes <
            0
                ? "under"
                : "over";

        const difference =
            Math.abs(
                summary.differenceMinutes,
            );

        const hours =
            Math.floor(
                difference / 60,
            );

        const minutes =
            difference % 60;

        const formattedDifference =
            `${hours}:${String(minutes).padStart(2, "0")}`;

        issues.push({
            severity: "warning",
            message:
                `${employee.name} is ${formattedDifference} ${direction} ` +
                `their weekly target for ${summary.weekStart}–${summary.weekEnd}.`,
            employeeId:
                employee.id,
        });
    }
}

function validateCoverage(
    state: PlannerState,
    issues: ValidationIssue[],
): void {
    const gaps =
        getCoverageGapsForMonth(
            state,
        );

    for (
        const gap
        of gaps
    ) {
        issues.push({
            severity: "error",
            message:
                `No store coverage ${gap.start}–${gap.end}.`,
            date:
                gap.date,
        });
    }
}

function groupShiftsByWeek(
    shifts: Shift[],
): Map<string, Shift[]> {
    const weeks =
        new Map<
            string,
            Shift[]
        >();

    for (
        const shift
        of shifts
    ) {
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

function weekIntersectsSelectedMonth(
    date: string,
    state: PlannerState,
): boolean {
    if (
        isDateInMonth(
            date,
            state.selectedYear,
            state.selectedMonth,
        )
    ) {
        return true;
    }

    const weekStart =
        getWeekStartDate(
            date,
        );

    for (
        let offset = 0;
        offset < 6;
        offset += 1
    ) {
        const value =
            new Date(
                `${weekStart}T00:00:00Z`,
            );

        value.setUTCDate(
            value.getUTCDate() +
                offset,
        );

        const candidate =
            [
                value.getUTCFullYear(),
                String(
                    value.getUTCMonth() +
                        1,
                ).padStart(
                    2,
                    "0",
                ),
                String(
                    value.getUTCDate(),
                ).padStart(
                    2,
                    "0",
                ),
            ].join("-");

        if (
            isDateInMonth(
                candidate,
                state.selectedYear,
                state.selectedMonth,
            )
        ) {
            return true;
        }
    }

    return false;
}

function isSingleDayEmployee(
    availableDays: number[],
): boolean {
    return availableDays.length === 1;
}