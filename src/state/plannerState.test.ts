import { describe, expect, it } from "vitest";
import {
    createInitialPlannerState,
    EMPLOYEES,
} from "./plannerState";
import type { Employee } from "../types/planning";

describe("plannerState - Initial State", () => {
    it("uses default employees when no employees are provided", () => {
        const state = createInitialPlannerState();

        expect(state.employees).toEqual(EMPLOYEES);
    });

    it("uses provided employees when employees are provided", () => {
        const providedEmployees: Employee[] = [
            {
                id: "test-1",
                firstName: "Test",
                lastName: "Emp 1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1, 2],
                },
            },
        ];

        const state = createInitialPlannerState(
            undefined,
            providedEmployees,
        );

        expect(state.employees).toEqual(providedEmployees);
    });
});
