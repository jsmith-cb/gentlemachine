import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import { validatePlannerState, validateShift } from "./validationService";
import { cloneStoreHours, DEFAULT_STORE_HOURS } from "./storeHoursService";

describe("vacation shift validation", () => {
    it("blocks a shift during the employee's vacation, including its boundary days", () => {
        const state = createInitialPlannerState();
        state.vacations = [{
            id: "vacation-1",
            employeeId: "a",
            startDate: "2026-09-07",
            endDate: "2026-09-09",
        }];

        for (const date of ["2026-09-07", "2026-09-08", "2026-09-09"]) {
            const issues = validateShift(state, {
                id: `shift-${date}`,
                employeeId: "a",
                date,
                start: "10:30",
                end: "15:30",
            });
            expect(issues).toContainEqual(expect.objectContaining({
                severity: "error",
                category: "availability",
                employeeId: "a",
                date,
                message: expect.stringContaining("on vacation"),
            }));
        }
    });

    it("does not block another employee or a date outside the vacation", () => {
        const state = createInitialPlannerState();
        state.vacations = [{
            id: "vacation-1",
            employeeId: "a",
            startDate: "2026-09-07",
            endDate: "2026-09-09",
        }];

        expect(validateShift(state, {
            id: "other-employee", employeeId: "b", date: "2026-09-08", start: "10:30", end: "15:30",
        }).some((issue) => issue.message.includes("on vacation"))).toBe(false);
        expect(validateShift(state, {
            id: "after-vacation", employeeId: "a", date: "2026-09-10", start: "10:30", end: "15:30",
        }).some((issue) => issue.message.includes("on vacation"))).toBe(false);
    });

    it("reports an existing conflicting shift in planner validation", () => {
        const state = createInitialPlannerState();
        state.selectedYear = 2026;
        state.selectedMonth = 9;
        state.vacations = [{
            id: "vacation-1", employeeId: "a", startDate: "2026-09-07", endDate: "2026-09-09",
        }];
        state.shifts = [{
            id: "shift-1", employeeId: "a", date: "2026-09-08", start: "10:30", end: "15:30",
        }];

        expect(validatePlannerState(state)).toContainEqual(expect.objectContaining({
            severity: "error",
            employeeId: "a",
            date: "2026-09-08",
            message: expect.stringContaining("on vacation"),
        }));
    });
});

describe("sickness shift validation", () => {
    it("keeps an existing shift and reports a hard sickness conflict", () => {
        const state = createInitialPlannerState();
        const employee = state.employees[0];
        state.shifts = [{ id: "sick-shift", employeeId: employee.id, date: "2026-10-05", start: "10:00", end: "14:00" }];
        state.sicknesses = [{ id: "sick-1", employeeId: employee.id, startDate: "2026-10-05", endDate: "2026-10-05" }];
        const issues = validatePlannerState(state);
        expect(state.shifts).toHaveLength(1);
        expect(issues.some((issue) => issue.severity === "error" && issue.message.includes("reported sick"))).toBe(true);
    });
});

describe("standard shift duration validation", () => {
    it("allows an eight-hour shift", () => {
        const state = createInitialPlannerState();
        const issues = validateShift(state, {
            id: "eight-hours",
            employeeId: "a",
            date: "2026-09-07",
            start: "10:30",
            end: "18:30",
        });

        expect(issues.some(({ message }) => message.includes("exceed 8 hours"))).toBe(false);
    });

    it("rejects a shift longer than eight hours", () => {
        const state = createInitialPlannerState();
        const issues = validateShift(state, {
            id: "over-eight-hours",
            employeeId: "a",
            date: "2026-09-07",
            start: "10:30",
            end: "19:00",
        });

        expect(issues).toContainEqual(expect.objectContaining({
            severity: "error",
            category: "shift",
            message: "Shift cannot exceed 8 hours.",
        }));
    });
});

describe("employee maximum paid hours per day", () => {
    function dailyState(maximumPaidMinutesPerDay?: number) {
        const state = createInitialPlannerState();
        state.selectedYear = 2026;
        state.selectedMonth = 9;
        state.employees = [{
            ...state.employees[0]!, maximumPaidMinutesPerDay,
        }];
        return state;
    }

    it("accepts totals below and exactly at the effective daily maximum", () => {
        const state = dailyState(8 * 60);
        state.shifts = [
            { id: "morning", employeeId: "a", date: "2026-09-07", start: "10:30", end: "14:30" },
            { id: "afternoon", employeeId: "a", date: "2026-09-07", start: "15:00", end: "19:00" },
        ];
        expect(validatePlannerState(state).some(({ message }) =>
            message.includes("paid hours on this day"),
        )).toBe(false);

        state.shifts[1] = { ...state.shifts[1]!, end: "18:30" };
        expect(validatePlannerState(state).some(({ message }) =>
            message.includes("paid hours on this day"),
        )).toBe(false);
    });

    it("rejects multiple shifts whose combined paid time exceeds the maximum", () => {
        const state = dailyState(8 * 60);
        state.shifts = [
            { id: "morning", employeeId: "a", date: "2026-09-07", start: "10:30", end: "14:30" },
            { id: "afternoon", employeeId: "a", date: "2026-09-07", start: "15:00", end: "19:30" },
        ];
        expect(validatePlannerState(state)).toContainEqual(expect.objectContaining({
            severity: "error", category: "hours", employeeId: "a",
            message: expect.stringContaining("8:30 paid hours"),
        }));
    });

    it("uses paid time after breaks instead of raw shift span", () => {
        const state = dailyState(5.5 * 60);
        state.shifts = [{
            id: "break-adjusted", employeeId: "a", date: "2026-09-07",
            start: "10:30", end: "16:30",
        }];
        expect(validatePlannerState(state).some(({ message }) =>
            message.includes("paid hours on this day"),
        )).toBe(false);
    });

    it("applies employee-specific overrides while retaining the eight-hour default", () => {
        const state = createInitialPlannerState();
        state.selectedYear = 2026; state.selectedMonth = 9;
        state.employees = [
            { ...state.employees[0]!, maximumPaidMinutesPerDay: 4 * 60 },
            { ...state.employees[1]!, maximumPaidMinutesPerDay: undefined },
        ];
        state.shifts = [
            { id: "a", employeeId: "a", date: "2026-09-07", start: "10:30", end: "15:30" },
            { id: "b", employeeId: "b", date: "2026-09-07", start: "10:30", end: "15:30" },
        ];
        const issues = validatePlannerState(state).filter(({ message }) =>
            message.includes("paid hours on this day"),
        );
        expect(issues).toHaveLength(1);
        expect(issues[0]?.employeeId).toBe("a");
    });
});

describe("Store Hours shift validation", () => {
    it("rejects shifts on closed days and outside a changed operating interval", () => {
        const storeHours = cloneStoreHours(DEFAULT_STORE_HOURS);
        storeHours.days = storeHours.days.map((day) => day.dayOfWeek === 1
            ? { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" }
            : day.dayOfWeek === 3
                ? { dayOfWeek: 3, isOpen: false }
                : day);
        const state = createInitialPlannerState([], undefined, [], storeHours);

        expect(validateShift(state, {
            id: "outside", employeeId: "a", date: "2026-09-21",
            start: "08:30", end: "12:30",
        })).toContainEqual(expect.objectContaining({
            category: "shift",
            message: "Shift must stay within store hours 09:00–18:00.",
        }));
        expect(validateShift(state, {
            id: "closed", employeeId: "a", date: "2026-09-23",
            start: "10:30", end: "14:30",
        })).toContainEqual(expect.objectContaining({
            category: "shift",
            message: "The store is closed on this day.",
        }));
    });
});

describe("monthly target guidance", () => {
    it("reports a visible adjusted-monthly-target difference when weekly checks do not", () => {
        const state = createInitialPlannerState();
        state.selectedYear = 2026;
        state.selectedMonth = 9;
        const employee = state.employees[0]!;
        state.employees = [{ ...employee, weeklyTargetMinutes: 60 }];
        state.shifts = [{
            id: "monthly-overage",
            employeeId: employee.id,
            date: "2026-09-01",
            start: "10:30",
            end: "15:00",
        }];

        expect(validatePlannerState(state)).toContainEqual(expect.objectContaining({
            severity: "warning",
            category: "hours",
            employeeId: employee.id,
            message: expect.stringContaining("adjusted monthly target"),
        }));
    });
});
