import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import {
    evaluateSoftRules,
    getApplicableWeekends,
} from "./softRulesService";
import { validatePlannerState } from "./validationService";

import type { Employee, Shift, StoreHours, VacationPeriod } from "../types/planning";

function employee(days: number[]): Employee {
    return {
        id: "employee", employeeNumber: "1", status: "active",
        firstName: "Weekend", lastName: "Worker",
        weeklyTargetMinutes: 8 * 60, maxDaysPerWeek: 2,
        maximumPaidMinutesPerDay: 8 * 60,
        availability: { days },
    };
}

function weekendHours(sundayOpen: boolean): StoreHours {
    return {
        days: [
            sundayOpen
                ? { dayOfWeek: 0, isOpen: true, openTime: "10:00", closeTime: "14:00" }
                : { dayOfWeek: 0, isOpen: false },
            ...([1, 2, 3, 4, 5] as const).map((dayOfWeek) => ({
                dayOfWeek, isOpen: false as const,
            })),
            { dayOfWeek: 6, isOpen: true, openTime: "10:00", closeTime: "14:00" },
        ],
    };
}

function shiftsFor(employeeId: string, dates: string[]): Shift[] {
    return dates.map((date, index) => ({
        id: `shift-${index}`, employeeId, date, start: "10:00", end: "14:00",
    }));
}

describe("one weekend off soft rule", () => {
    it("is disabled by configuration", () => {
        const person = employee([6]);
        const state = createInitialPlannerState(
            shiftsFor(person.id, ["2026-03-07", "2026-03-14", "2026-03-21", "2026-03-28"]),
            [person], [], weekendHours(false), { oneWeekendOffPerMonth: false },
        );
        state.selectedYear = 2026; state.selectedMonth = 3;
        expect(evaluateSoftRules(state)).toEqual([]);
    });

    it("supports Saturday-only operation and Saturday-only employees", () => {
        const person = employee([6]);
        expect(getApplicableWeekends(person, [], weekendHours(false), 2026, 3))
            .toHaveLength(4);
    });

    it("requires both applicable days off when store and employee include Saturday and Sunday", () => {
        const person = employee([6, 0]);
        const state = createInitialPlannerState(
            shiftsFor(person.id, [
                "2026-03-01", "2026-03-07", "2026-03-14", "2026-03-21", "2026-03-28",
            ]),
            [person], [], weekendHours(true), { oneWeekendOffPerMonth: true },
        );
        state.selectedYear = 2026; state.selectedMonth = 3;
        expect(evaluateSoftRules(state)).toHaveLength(1);
    });

    it("does not apply to an employee unavailable all weekend", () => {
        const person = employee([1, 2, 3, 4, 5]);
        expect(getApplicableWeekends(person, [], weekendHours(true), 2026, 3)).toEqual([]);
    });

    it("recognizes a deliberately unscheduled applicable weekend", () => {
        const person = employee([6]);
        const state = createInitialPlannerState(
            shiftsFor(person.id, ["2026-03-07", "2026-03-14", "2026-03-21"]),
            [person], [], weekendHours(false), { oneWeekendOffPerMonth: true },
        );
        state.selectedYear = 2026; state.selectedMonth = 3;
        expect(evaluateSoftRules(state)).toEqual([]);
    });

    it("reports guidance when every applicable weekend is scheduled", () => {
        const person = employee([6]);
        const state = createInitialPlannerState(
            shiftsFor(person.id, ["2026-03-07", "2026-03-14", "2026-03-21", "2026-03-28"]),
            [person], [], weekendHours(false), { oneWeekendOffPerMonth: true },
        );
        state.selectedYear = 2026; state.selectedMonth = 3;
        expect(evaluateSoftRules(state)).toEqual([expect.objectContaining({
            employeeId: person.id, rule: "oneWeekendOffPerMonth",
        })]);
        expect(validatePlannerState(state).some(({ category }) => category === "soft-rule"))
            .toBe(false);
    });

    it("does not count a weekend containing vacation as the protected weekend", () => {
        const person = employee([6, 0]);
        const vacation: VacationPeriod = {
            id: "vacation", employeeId: person.id,
            startDate: "2026-03-07", endDate: "2026-03-07",
        };
        const candidates = getApplicableWeekends(
            person, [vacation], weekendHours(true), 2026, 3,
        );
        expect(candidates.some(({ dates }) => dates.includes("2026-03-08"))).toBe(false);
    });
});
