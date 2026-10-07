import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import {
    getAdjustedMonthlyTargetMinutes,
    getAdjustedWeeklyTargetMinutes,
    getEmployeeMonthSummaries,
    getEmployeeWeekSummaries,
    getBreakMinutes,
    getPaidShiftMinutes,
    getMonthlyTargetMinutes,
} from "./hoursService";

describe("dormant break calculation", () => {
    it("retains the inclusive break thresholds for future break/time-clock use", () => {
        expect([300, 360, 420, 480].map(getBreakMinutes)).toEqual([15, 30, 45, 60]);
        expect(getPaidShiftMinutes({
            id: "break-example", employeeId: "employee", date: "2026-09-01",
            start: "10:30", end: "15:30",
        })).toBe(285);
    });
});

describe("vacation-adjusted targets", () => {
    it("reduces weekly and monthly targets without changing scheduled hours", () => {
        const state = createInitialPlannerState();
        state.selectedYear = 2026;
        state.selectedMonth = 9;
        const employee = state.employees[0];
        employee.weeklyTargetMinutes = 35 * 60;
        employee.maxDaysPerWeek = 5;
        state.vacations = [{
            id: "vacation-1", employeeId: employee.id,
            startDate: "2026-09-07", endDate: "2026-09-08",
        }];
        state.shifts = [{
            id: "shift-1", employeeId: employee.id,
            date: "2026-09-09", start: "10:30", end: "15:30",
        }];

        const week = getEmployeeWeekSummaries(state).find((summary) =>
            summary.employeeId === employee.id && summary.weekStart === "2026-09-07");
        expect(week?.targetMinutes).toBe(21 * 60);
        expect(week?.scheduledMinutes).toBe(5 * 60);
        expect(week?.differenceMinutes).toBe(-(16 * 60));
        expect(getAdjustedMonthlyTargetMinutes(employee, state.vacations, 2026, 9)).toBe(
            getMonthlyTargetMinutes(employee.weeklyTargetMinutes, 2026, 9) - 14 * 60,
        );
        expect(getEmployeeMonthSummaries(state).find((summary) =>
            summary.employeeId === employee.id)?.scheduledMinutes).toBe(5 * 60);
    });

    it("ignores unavailable days, other employees, and duplicate overlapping periods", () => {
        const state = createInitialPlannerState();
        const employee = state.employees[0];
        employee.weeklyTargetMinutes = 35 * 60;
        employee.maxDaysPerWeek = 5;
        const vacations = [
            { id: "one", employeeId: employee.id, startDate: "2026-09-07", endDate: "2026-09-08" },
            { id: "two", employeeId: employee.id, startDate: "2026-09-08", endDate: "2026-09-08" },
            { id: "other", employeeId: "b", startDate: "2026-09-09", endDate: "2026-09-09" },
            { id: "sunday", employeeId: employee.id, startDate: "2026-09-13", endDate: "2026-09-13" },
        ];
        expect(getAdjustedWeeklyTargetMinutes(employee, vacations, "2026-09-07", "2026-09-12"))
            .toBe(21 * 60);
    });

    it("never reduces a weekly target below zero", () => {
        const state = createInitialPlannerState();
        const employee = state.employees[0];
        employee.weeklyTargetMinutes = 35 * 60;
        employee.maxDaysPerWeek = 5;
        expect(getAdjustedWeeklyTargetMinutes(employee, [{
            id: "full-week", employeeId: employee.id,
            startDate: "2026-09-07", endDate: "2026-09-12",
        }], "2026-09-07", "2026-09-12")).toBe(0);
    });
});
