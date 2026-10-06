import { describe, expect, it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import type { Employee, SchedulingRuleSettings, StoreHours } from "../types/planning";
import {
    ALL_PLANNING_RULES,
    DEFAULT_SCHEDULING_RULE_SETTINGS,
    evaluatePlanningRules,
    getApplicableSaturdays,
    isValidSchedulingRuleSettings,
    preferredRules,
    REQUIRED_RULE_EXECUTION_ORDER,
} from "./schedulingRulesService";

const HOURS: StoreHours = {
    days: [
        { dayOfWeek: 0, isOpen: false },
        { dayOfWeek: 1, isOpen: true, openTime: "10:00", closeTime: "18:00" },
        { dayOfWeek: 2, isOpen: false },
        { dayOfWeek: 3, isOpen: false },
        { dayOfWeek: 4, isOpen: false },
        { dayOfWeek: 5, isOpen: false },
        { dayOfWeek: 6, isOpen: true, openTime: "10:00", closeTime: "18:00" },
    ],
};

const EMPLOYEE: Employee = {
    id: "employee", employeeNumber: "001", status: "active",
    firstName: "Alex", lastName: "Example", weeklyTargetMinutes: 8 * 60,
    maxDaysPerWeek: 2, availability: { days: [1, 6] },
};

describe("SchedulingRuleSettings", () => {
    it("validates the complete typed canonical shape", () => {
        expect(isValidSchedulingRuleSettings(DEFAULT_SCHEDULING_RULE_SETTINGS)).toBe(true);
        expect(isValidSchedulingRuleSettings({
            ...DEFAULT_SCHEDULING_RULE_SETTINGS,
            preferredOrder: [...ALL_PLANNING_RULES, "contracted-hours"],
        })).toBe(false);
        expect(isValidSchedulingRuleSettings({
            ...DEFAULT_SCHEDULING_RULE_SETTINGS,
            minimumGeneratedShiftMinutes: 75,
        })).toBe(false);
    });

    it("removes required rules from the effective preferred order without losing their saved position", () => {
        const settings = structuredClone(DEFAULT_SCHEDULING_RULE_SETTINGS);
        settings.modes["contracted-hours"] = "require";
        expect(preferredRules(settings)).not.toContain("contracted-hours");
        expect(settings.preferredOrder).toContain("contracted-hours");
    });

    it("has an explicit stable required-rule execution order", () => {
        expect(REQUIRED_RULE_EXECUTION_ORDER).toEqual([
            "one-saturday-off-per-month",
            "opening-hours-coverage",
            "contracted-hours",
        ]);
    });
});

describe("Saturday-off objective", () => {
    it("applies to an employee with Saturday and a normally workable non-Saturday", () => {
        expect(getApplicableSaturdays(EMPLOYEE, [], HOURS, 2026, 10).length).toBeGreaterThan(0);
    });

    it("does not apply to Saturday-only or weekend-only employees", () => {
        expect(getApplicableSaturdays(
            { ...EMPLOYEE, availability: { days: [6] } }, [], HOURS, 2026, 10,
        )).toEqual([]);
        const weekendHours: StoreHours = { days: HOURS.days.map((day) =>
            day.dayOfWeek === 0
                ? { dayOfWeek: 0, isOpen: true, openTime: "10:00", closeTime: "18:00" }
                : day) };
        expect(getApplicableSaturdays(
            { ...EMPLOYEE, availability: { days: [0, 6] } }, [], weekendHours, 2026, 10,
        )).toEqual([]);
    });

    it("does not count a Saturday made unavailable by canonical absence", () => {
        const saturdays = getApplicableSaturdays(EMPLOYEE, [{
            id: "absence", employeeId: EMPLOYEE.id,
            startDate: "2026-10-03", endDate: "2026-10-03",
        }], HOURS, 2026, 10);
        expect(saturdays.map(({ date }) => date)).not.toContain("2026-10-03");
    });

    it("distinguishes required failure from preferred guidance", () => {
        const shifts = getApplicableSaturdays(EMPLOYEE, [], HOURS, 2026, 10).map(({ date }, index) => ({
            id: `shift-${index}`, employeeId: EMPLOYEE.id, date, start: "10:00", end: "12:00",
        }));
        const settings: SchedulingRuleSettings = structuredClone(DEFAULT_SCHEDULING_RULE_SETTINGS);
        settings.modes["one-saturday-off-per-month"] = "require";
        const state = createInitialPlannerState(shifts, [EMPLOYEE], [], HOURS, settings);
        state.selectedYear = 2026; state.selectedMonth = 10;
        expect(evaluatePlanningRules(state)).toContainEqual(expect.objectContaining({
            rule: "one-saturday-off-per-month", level: "required",
        }));
    });
});
