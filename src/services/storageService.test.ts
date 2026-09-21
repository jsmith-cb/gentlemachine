import {
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import {
    getStoredEmployees,
} from "./storageService";

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

        expect(getStoredEmployees()).toEqual(employees);
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

        expect(getStoredEmployees()).toEqual(employees);
    });
});
