import type {
    BreakRule,
    Employee,
    PlannerState,
    StoreHours,
} from "../types/planning";

export const STORE_HOURS: StoreHours = {
    open: "10:30",
    close: "20:30",
};

export const BREAK_RULES: BreakRule[] = [
    {
        minimumShiftMinutes: 8 * 60,
        breakMinutes: 60,
    },
    {
        minimumShiftMinutes: 7 * 60,
        breakMinutes: 45,
    },
    {
        minimumShiftMinutes: 6 * 60,
        breakMinutes: 30,
    },
    {
        minimumShiftMinutes: 5 * 60,
        breakMinutes: 15,
    },
];

const MONDAY_TO_SATURDAY = [
    1,
    2,
    3,
    4,
    5,
    6,
];

const MONDAY_TO_FRIDAY = [
    1,
    2,
    3,
    4,
    5,
];

export const EMPLOYEES: Employee[] = [
    {
        id: "a",
        name: "Employee A",
        weeklyTargetMinutes: 35 * 60,
        maxDaysPerWeek: 5,
        availability: {
            days: MONDAY_TO_SATURDAY,
        },
    },
    {
        id: "b",
        name: "Employee B",
        weeklyTargetMinutes: 20 * 60,
        maxDaysPerWeek: 5,
        availability: {
            days: MONDAY_TO_SATURDAY,
        },
    },
    {
        id: "c",
        name: "Employee C",
        weeklyTargetMinutes: 15 * 60,
        maxDaysPerWeek: 5,
        availability: {
            days: MONDAY_TO_FRIDAY,
            earliestStart: "09:00",
            latestEnd: "15:30",
        },
    },
    {
        id: "d",
        name: "Employee D",
        weeklyTargetMinutes: 15 * 60,
        maxDaysPerWeek: 5,
        availability: {
            days: MONDAY_TO_SATURDAY,
        },
    },
    {
        id: "e",
        name: "Employee E",
        weeklyTargetMinutes: 5 * 60,
        maxDaysPerWeek: 1,
        availability: {
            days: [6],
        },
    },
];

export function createInitialPlannerState(): PlannerState {
    const now = new Date();

    return {
        selectedYear: now.getFullYear(),
        selectedMonth: now.getMonth() + 1,
        storeHours: STORE_HOURS,
        employees: EMPLOYEES,
        shifts: [],
    };
}