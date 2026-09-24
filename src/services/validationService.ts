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
import { employeeFullName } from "./employeeIdentity";
import { legalAvailabilityHours } from "./availabilityService";
import { overlapsVacation } from "./vacationService";
import { activeEmployees } from "./teamService";
import {
    exceedsMaximumStandardShift,
    MAXIMUM_STANDARD_SHIFT_MINUTES,
} from "./shiftRules";
import { getOperatingHoursForDate } from "./storeHoursService";

import type {
    PlannerState,
    Shift,
    ValidationIssue,
} from "../types/planning";

export function validateShift(
    state: PlannerState,
    shift: Shift,
    existingShift = false,
    today = localTodayDateKey(),
): ValidationIssue[] {
    const issues:
        ValidationIssue[] = [];

    validateShiftTime(
        shift,
        issues,
    );

    validateStoreHours(state, shift, issues);

    validateEmployeeAvailability(
        state,
        shift,
        issues,
        existingShift,
        today,
    );

    return issues;
}

function validateStoreHours(
    state: PlannerState,
    shift: Shift,
    issues: ValidationIssue[],
): void {
    const operating = getOperatingHoursForDate(state.storeHours, shift.date);
    if (!operating) {
        issues.push({
            severity: "error",
            category: "shift",
            message: "The store is closed on this day.",
            employeeId: shift.employeeId,
            date: shift.date,
        });
        return;
    }
    if (timeToMinutes(shift.start) < timeToMinutes(operating.open) ||
        timeToMinutes(shift.end) > timeToMinutes(operating.close)) {
        issues.push({
            severity: "error",
            category: "shift",
            message: `Shift must stay within store hours ${operating.open}–${operating.close}.`,
            employeeId: shift.employeeId,
            date: shift.date,
        });
    }
}

export function validatePlannerState(
    state: PlannerState,
    today = localTodayDateKey(),
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
                    true,
                    today,
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
            category: "shift",
            message:
                "Shift end time must be after the start time.",
            employeeId:
                shift.employeeId,
            date:
                shift.date,
        });
    }

    if (exceedsMaximumStandardShift(shift)) {
        issues.push({
            severity: "error",
            category: "shift",
            message: `Shift cannot exceed ${MAXIMUM_STANDARD_SHIFT_MINUTES / 60} hours.`,
            employeeId: shift.employeeId,
            date: shift.date,
        });
    }
}

function validateEmployeeAvailability(
    state: PlannerState,
    shift: Shift,
    issues: ValidationIssue[],
    existingShift: boolean,
    today: string,
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
            category: "availability",
            message:
                "Shift references an unknown employee.",
            employeeId:
                shift.employeeId,
            date:
                shift.date,
        });

        return;
    }

    if (employee.status === "inactive") {
        if (!existingShift || shift.date >= today) {
            issues.push({
                severity: existingShift ? "warning" : "error",
                category: "availability",
                message: `${employeeFullName(employee)} is inactive but has a shift on this day.`,
                employeeId: employee.id,
                date: shift.date,
            });
        }
        if (!existingShift) return;
    }

    if (overlapsVacation(state.vacations, employee.id, shift.date, shift.date)) {
        issues.push({
            severity: "error",
            category: "availability",
            message: `${employeeFullName(employee)} is on vacation on this day.`,
            employeeId: employee.id,
            date: shift.date,
        });
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
            category: "availability",
            message:
                `${employeeFullName(employee)} is not available on this day.`,
            employeeId:
                employee.id,
            date:
                shift.date,
        });
    }

    const { earliestStart, latestEnd } = legalAvailabilityHours(employee.availability);

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
            category: "availability",
            message:
                `${employeeFullName(employee)} cannot start before ${earliestStart}.`,
            employeeId:
                employee.id,
            date:
                shift.date,
        });
    }

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
            category: "availability",
            message:
                `${employeeFullName(employee)} cannot work after ${latestEnd}.`,
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
            of activeEmployees(state.employees)
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
                    category: "hours",
                    message:
                        `${employeeFullName(employee)} works ${daysWorked} days ` +
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
            !employee || employee.status === "inactive" ||
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
            category: "hours",
            message:
                `${employeeFullName(employee)} is ${formattedDifference} ${direction} ` +
                `their weekly target for ${summary.weekStart}–${summary.weekEnd}.`,
            employeeId:
                employee.id,
        });
    }
}

function localTodayDateKey(): string {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")].join("-");
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
            category: "coverage",
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
