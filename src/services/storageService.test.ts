import {
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import {
    getStoredEmployees,
    getStoredStoreHours,
    getStoredSoftRuleSettings,
    getStoredVacations,
    setStoredEmployees,
    setStoredStoreHours,
    setStoredSoftRuleSettings,
    setStoredVacations,
} from "./storageService";
import { cloneStoreHours, DEFAULT_STORE_HOURS } from "./storeHoursService";
import { DEFAULT_SOFT_RULE_SETTINGS } from "./softRulesService";

const EMPLOYEE_STORAGE_KEY = "@pp_crew_employees";

// Minimal in-memory localStorage mock
const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = String(value);
        },
        clear: () => {
            store = {};
        },
    };
})();

// Inject mock into global scope
Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
});

describe("storageService - Employee Persistence", () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it("returns undefined when no employee storage exists", () => {
        expect(getStoredEmployees()).toBeUndefined();
    });

    it("returns undefined for malformed (non-array) employee storage", () => {
        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify({ not: "an array" }),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("returns undefined for empty employee array", () => {
        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify([]),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("returns valid persisted employees when storage is correct", () => {
        const employees = [
            {
                id: "e1",
                firstName: "Emp",
                lastName: "1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1, 2, 3],
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employees),
        );

        expect(getStoredEmployees()).toEqual(employees.map((employee) => ({
            ...employee, employeeNumber: employee.id, status: "active",
        })));
    });

    it("persists a reduced employee daily-hours override", () => {
        const employee = {
            id: "daily-limit", employeeNumber: "DL", status: "active" as const,
            firstName: "Daily", lastName: "Limit", weeklyTargetMinutes: 20 * 60,
            maximumPaidMinutesPerDay: 6 * 60,
            maxDaysPerWeek: 5, availability: { days: [1, 2, 3, 4, 5] },
        };
        setStoredEmployees([employee]);
        expect(getStoredEmployees()).toEqual([employee]);
    });

    it("rejects a daily-hours override above Crew's eight-hour default", () => {
        localStorageMock.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify([{
            id: "daily-limit", employeeNumber: "DL", status: "active",
            firstName: "Daily", lastName: "Limit", weeklyTargetMinutes: 20 * 60,
            maximumPaidMinutesPerDay: 9 * 60,
            maxDaysPerWeek: 5, availability: { days: [1, 2, 3, 4, 5] },
        }]));
        expect(getStoredEmployees()).toBeUndefined();
    });

    it("rejects a daily-hours override outside 30-minute increments", () => {
        localStorageMock.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify([{
            id: "daily-limit", employeeNumber: "DL", status: "active",
            firstName: "Daily", lastName: "Limit", weeklyTargetMinutes: 20 * 60,
            maximumPaidMinutesPerDay: 370,
            maxDaysPerWeek: 5, availability: { days: [1, 2, 3, 4, 5] },
        }]));
        expect(getStoredEmployees()).toBeUndefined();
    });

    it("persists optional employee contact details without changing employee identity", () => {
        const employee = {
            id: "e1",
            firstName: "Emp",
            lastName: "One",
            email: "emp@example.com",
            telephoneNumber: "+49 30 123456",
            weeklyTargetMinutes: 60,
            maxDaysPerWeek: 5,
            availability: { days: [1, 2, 3] },
        };
        localStorageMock.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify([employee]));
        expect(getStoredEmployees()).toEqual([{
            ...employee, employeeNumber: employee.id, status: "active",
        }]);

        localStorageMock.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify([{ ...employee, email: 42 }]));
        expect(getStoredEmployees()).toBeUndefined();
    });

    it("persists new lifecycle fields and upgrades existing records without changing their IDs", () => {
        const oldEmployee = {
            id: "original-reference", firstName: "Mina", lastName: "Cole",
            weeklyTargetMinutes: 1200, maxDaysPerWeek: 5, availability: { days: [1, 2, 3] },
        };
        localStorageMock.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify([oldEmployee]));
        expect(getStoredEmployees()).toEqual([{
            ...oldEmployee, employeeNumber: "original-reference", status: "active",
        }]);
        expect(JSON.parse(localStorageMock.getItem(EMPLOYEE_STORAGE_KEY)!)[0].id).toBe("original-reference");

        const inactive = { ...getStoredEmployees()![0], status: "inactive" as const };
        setStoredEmployees([inactive]);
        expect(getStoredEmployees()).toEqual([inactive]);
    });

    it("reloads a newly added member with distinct internal and business identifiers", () => {
        const employee = {
            id: "employee-generated-uuid", employeeNumber: "TM-12", status: "active" as const,
            firstName: "Test", lastName: "Member", weeklyTargetMinutes: 600,
            maximumPaidMinutesPerDay: 8 * 60,
            maxDaysPerWeek: 3, availability: { days: [1, 2, 3] },
        };
        setStoredEmployees([employee]);
        expect(getStoredEmployees()).toEqual([employee]);
    });

    it("accepts valid day-specific hours and rejects malformed overrides", () => {
        const employee = {
            id: "e1",
            firstName: "Emp",
            lastName: "1",
            weeklyTargetMinutes: 60,
            maxDaysPerWeek: 5,
            availability: {
                days: [1, 2],
                earliestStart: "10:00",
                latestEnd: "18:00",
                dayHours: { 1: { earliestStart: "08:00", latestEnd: "14:00" } },
            },
        };
        localStorageMock.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify([employee]));
        expect(getStoredEmployees()).toEqual([{
            ...employee, employeeNumber: employee.id, status: "active",
        }]);

        employee.availability.dayHours[1].latestEnd = "25:00";
        localStorageMock.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify([employee]));
        expect(getStoredEmployees()).toBeUndefined();
    });

    it("rejects employee with empty id", () => {
        const employees = [
            {
                id: "",
                firstName: "Emp",
                lastName: "1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1],
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employees),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("rejects employee with empty name", () => {
        const employees = [
            {
                id: "e1",
                firstName: "",
                lastName: "1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1],
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employees),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("rejects employee with weeklyTargetMinutes below 0", () => {
        const employees = [
            {
                id: "e1",
                firstName: "Emp",
                lastName: "1",
                weeklyTargetMinutes: -1,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1],
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employees),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("rejects employee with maxDaysPerWeek outside 1-7", () => {
        const employeesHigh = [
            {
                id: "e1",
                firstName: "Emp",
                lastName: "1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 8,
                availability: {
                    days: [1],
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employeesHigh),
        );

        expect(getStoredEmployees()).toBeUndefined();

        const employeesLow = [
            {
                id: "e2",
                firstName: "Emp",
                lastName: "2",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 0,
                availability: {
                    days: [1],
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employeesLow),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("rejects availability day as string '1'", () => {
        const employees = [
            {
                id: "e1",
                firstName: "Emp",
                lastName: "1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: ["1"],
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employees),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("rejects availability day 2.5", () => {
        const employees = [
            {
                id: "e1",
                firstName: "Emp",
                lastName: "1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [2.5],
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employees),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("rejects availability day outside 1-7", () => {
        const employees = [
            {
                id: "e1",
                firstName: "Emp",
                lastName: "1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [8],
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employees),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("rejects invalid time such as 99:99", () => {
        const employees = [
            {
                id: "e1",
                firstName: "Emp",
                lastName: "1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1],
                    earliestStart: "99:99",
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employees),
        );

        expect(getStoredEmployees()).toBeUndefined();
    });

    it("accepts valid HH:mm values", () => {
        const employees = [
            {
                id: "e1",
                firstName: "Emp",
                lastName: "1",
                weeklyTargetMinutes: 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1],
                    earliestStart: "09:00",
                    latestEnd: "17:00",
                },
            },
        ];

        localStorageMock.setItem(
            EMPLOYEE_STORAGE_KEY,
            JSON.stringify(employees),
        );

        expect(getStoredEmployees()).toEqual(employees.map((employee) => ({
            ...employee, employeeNumber: employee.id, status: "active",
        })));
    });
});

describe("storageService - Vacation Persistence", () => {
    beforeEach(() => localStorageMock.clear());

    it("persists a vacation period", () => {
        const periods = [{
            id: "vacation-1",
            employeeId: "e1",
            startDate: "2026-09-29",
            endDate: "2026-10-02",
        }];
        setStoredVacations(periods);
        expect(getStoredVacations()).toEqual(periods);
    });

    it("rejects malformed saved periods", () => {
        localStorageMock.setItem("@pp_crew_vacations", JSON.stringify([{
            id: "vacation-1",
            employeeId: "e1",
            startDate: "2026-09-31",
            endDate: "2026-10-02",
        }]));
        expect(getStoredVacations()).toEqual([]);
    });
});

describe("storageService - Store Hours Persistence", () => {
    beforeEach(() => localStorageMock.clear());

    it("uses defaults when no Store Hours are persisted", () => {
        expect(getStoredStoreHours()).toEqual(DEFAULT_STORE_HOURS);
    });

    it("persists and reloads custom Store Hours", () => {
        const custom = cloneStoreHours(DEFAULT_STORE_HOURS);
        custom.days = custom.days.map((day) => day.dayOfWeek === 1
            ? { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" }
            : day.dayOfWeek === 3
                ? { dayOfWeek: 3, isOpen: false }
                : day);
        setStoredStoreHours(custom);
        expect(getStoredStoreHours()).toEqual(custom);
    });

    it("rejects malformed persisted Store Hours and returns defaults", () => {
        localStorageMock.setItem("@pp_crew_store_hours", JSON.stringify({
            days: [{ dayOfWeek: 1, isOpen: true, openTime: "20:00", closeTime: "09:00" }],
        }));
        expect(getStoredStoreHours()).toEqual(DEFAULT_STORE_HOURS);
    });
});

describe("storageService - Soft Rules Persistence", () => {
    beforeEach(() => localStorageMock.clear());

    it("uses disabled defaults when no Soft Rules are persisted", () => {
        expect(getStoredSoftRuleSettings()).toEqual(DEFAULT_SOFT_RULE_SETTINGS);
    });

    it("persists and reloads typed Soft Rules", () => {
        const settings = { oneWeekendOffPerMonth: true };
        setStoredSoftRuleSettings(settings);
        expect(getStoredSoftRuleSettings()).toEqual(settings);
    });

    it("rejects malformed persisted Soft Rules and returns defaults", () => {
        localStorageMock.setItem("@pp_crew_soft_rules", JSON.stringify({
            oneWeekendOffPerMonth: "yes",
        }));
        expect(getStoredSoftRuleSettings()).toEqual(DEFAULT_SOFT_RULE_SETTINGS);
    });
});
