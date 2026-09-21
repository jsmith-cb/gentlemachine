import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import {
    getAdjustedMonthlyTargetMinutes,
    getAdjustedWeeklyTargetMinutes,
    getEmployeeMonthSummaries,
    getEmployeeWeekSummaries,
    getMonthlyTargetMinutes,
} from "./hoursService";

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
        expect(week?.scheduledMinutes).toBe(4 * 60 + 45);
        expect(week?.differenceMinutes).toBe(-(16 * 60 + 15));
        expect(getAdjustedMonthlyTargetMinutes(employee, state.vacations, 2026, 9)).toBe(
            getMonthlyTargetMinutes(employee.weeklyTargetMinutes, 2026, 9) - 14 * 60,
        );
        expect(getEmployeeMonthSummaries(state).find((summary) =>
            summary.employeeId === employee.id)?.scheduledMinutes).toBe(4 * 60 + 45);
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
