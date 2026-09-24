import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import { validatePlannerState, validateShift } from "./validationService";

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
