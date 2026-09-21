import { describe, expect, it } from "vitest";
import { employeeSelectOptions } from "./employeeIdentity";
import type { Employee } from "../types/planning";

function employee(id: string, firstName: string, lastName: string): Employee {
    return {
        id,
        firstName,
        lastName,
        weeklyTargetMinutes: 0,
        maxDaysPerWeek: 5,
        availability: { days: [1] },
    };
}

describe("employeeSelectOptions", () => {
    it("sorts by first name and shows only unique first names", () => {
        expect(employeeSelectOptions([
            employee("z", "Zoe", "Able"),
            employee("a", "Alex", "Baker"),
        ]).map(({ label }) => label)).toEqual(["Alex", "Zoe"]);
    });

    it("shows full names when first names collide, regardless of case", () => {
        expect(employeeSelectOptions([
            employee("2", "alex", "Zimmer"),
            employee("1", "Alex", "Baker"),
            employee("3", "Bea", "Stone"),
        ]).map(({ label }) => label)).toEqual(["Alex Baker", "alex Zimmer", "Bea"]);
    });
});
