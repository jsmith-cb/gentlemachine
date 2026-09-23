import { describe, expect, it } from "vitest";
import { EMPLOYEES, createInitialPlannerState } from "../state/plannerState";
import { renderPlannerCalendar } from "../pages/PlannerCalendar";
import { renderPlannerMonthlyOverview } from "../pages/PlannerMonthlyOverview";
import { getEmployeeMonthSummaries } from "./hoursService";
import { validatePlannerState, validateShift } from "./validationService";
import { activeEmployees, createTeamMemberDraft, deactivateTeamMember, employeesForPlanningPeriod } from "./teamService";

describe("team-member lifecycle", () => {
    it("generates a separate immutable reference for a new member", () => {
        const first = createTeamMemberDraft();
        const second = createTeamMemberDraft();
        expect(first.id).toMatch(/^employee-/);
        expect(first.id).not.toBe(second.id);
        expect(first.employeeNumber).toBe("");
        expect(first.status).toBe("active");
    });

    it("deactivates without removing the employee or changing record references", () => {
        const state = createInitialPlannerState(
            [{ id: "shift-1", employeeId: "a", date: "2026-10-05", start: "10:30", end: "15:30" }],
            EMPLOYEES,
            [{ id: "vacation-1", employeeId: "a", startDate: "2026-11-01", endDate: "2026-11-02" }],
        );
        state.employees = deactivateTeamMember(state.employees, "a");
        expect(activeEmployees(state.employees).some((employee) => employee.id === "a")).toBe(false);
        expect(state.employees.find((employee) => employee.id === "a")?.firstName).toBe("Employee");
        expect(state.shifts[0]?.employeeId).toBe("a");
        expect(state.vacations[0]?.employeeId).toBe("a");
        expect(employeesForPlanningPeriod(state.employees, state.shifts, "2026-10-01", "2026-10-31")
            .some((employee) => employee.id === "a")).toBe(true);
        expect(employeesForPlanningPeriod(state.employees, state.shifts, "2026-12-01", "2026-12-31")
            .some((employee) => employee.id === "a")).toBe(false);
        state.selectedYear = 2026;
        state.selectedMonth = 10;
        expect(renderPlannerCalendar(state, null, [])).toContain("Employee A");
        expect(renderPlannerMonthlyOverview(state, getEmployeeMonthSummaries(state))).toContain("Employee A");
        expect(renderPlannerCalendar(state, { type: "add", date: "2026-10-06" }, []))
            .not.toMatch(/<option\s+value="a"/);
    });

    it("blocks new assignments but warns about preserved future shifts", () => {
        const state = createInitialPlannerState();
        state.employees = deactivateTeamMember(state.employees, "a");
        state.selectedYear = 2026;
        state.selectedMonth = 10;
        const shift = { id: "shift-1", employeeId: "a", date: "2026-10-05", start: "10:30", end: "15:30" };
        expect(validateShift(state, shift)).toContainEqual(expect.objectContaining({
            severity: "error", message: expect.stringContaining("inactive"),
        }));
        state.shifts = [shift];
        expect(validatePlannerState(state, "2026-09-22")).toContainEqual(expect.objectContaining({
            severity: "warning", employeeId: "a", date: "2026-10-05",
            message: expect.stringContaining("inactive"),
        }));
        expect(validatePlannerState(state, "2026-11-01").some((issue) =>
            issue.message.includes("inactive"))).toBe(false);
    });
});
