import { describe, expect, it } from "vitest";
import {
    buildScheduleWeeks,
    scheduleFilterEmployees,
} from "./SchedulePage";

import type { Employee, Shift } from "../types/planning";
import { cloneStoreHours, DEFAULT_STORE_HOURS } from "../services/storeHoursService";


function employee(id: string, status: Employee["status"] = "active"): Employee {
    return {
        id,
        employeeNumber: id,
        status,
        firstName: id === "a" ? "Alice" : "Ben",
        lastName: "Crew",
        weeklyTargetMinutes: 0,
        maximumPaidMinutesPerDay: 8 * 60,
        maxDaysPerWeek: 5,
        availability: { days: [1, 2, 3, 4, 5] },
    };
}

const EMPLOYEES = [employee("a"), employee("b", "inactive")];

const SHIFTS: Shift[] = [
    { id: "oct-b", employeeId: "b", date: "2026-10-01", start: "12:00", end: "18:00" },
    { id: "sep-late", employeeId: "a", date: "2026-09-28", start: "12:00", end: "18:00" },
    { id: "sep-split", employeeId: "a", date: "2026-09-28", start: "08:00", end: "09:00" },
    { id: "sep-early-b", employeeId: "b", date: "2026-09-28", start: "10:00", end: "16:00" },
    { id: "sep-early-a", employeeId: "a", date: "2026-09-28", start: "10:00", end: "15:00" },
];

describe("Schedule presentation", () => {
    it("creates employee rows and configured operating-day columns", () => {
        const weeks = buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 9, null, DEFAULT_STORE_HOURS,
        );

        expect(weeks).toHaveLength(1);
        expect(weeks[0]).toMatchObject({
            weekStart: "2026-09-28",
            displayStart: "2026-09-28",
            displayEnd: "2026-10-03",
        });
        expect(weeks[0]?.columns.map(({ date }) => date)).toEqual([
            "2026-09-28",
            "2026-09-29",
            "2026-09-30",
            "2026-10-01",
            "2026-10-02",
            "2026-10-03",
        ]);
        expect(weeks[0]?.rows.map(({ employeeId }) => employeeId)).toEqual(["a", "b"]);
    });

    it("maps and orders every shift in the correct employee/day cell", () => {
        const [week] = buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 9, null, DEFAULT_STORE_HOURS,
        );
        const aliceMonday = week?.rows
            .find(({ employeeId }) => employeeId === "a")
            ?.cells.find(({ date }) => date === "2026-09-28");

        expect(aliceMonday?.shifts.map(({ id }) => id)).toEqual([
            "sep-split",
            "sep-early-a",
            "sep-late",
        ]);
        expect(week?.rows
            .find(({ employeeId }) => employeeId === "a")
            ?.cells.find(({ date }) => date === "2026-09-29")
            ?.shifts).toEqual([]);
    });

    it("derives columns from configured open days rather than a Schedule weekday rule", () => {
        const configured = cloneStoreHours(DEFAULT_STORE_HOURS);
        configured.days = configured.days.map((day) =>
            [1, 4, 6].includes(day.dayOfWeek)
                ? day.isOpen ? day : { dayOfWeek: day.dayOfWeek, isOpen: true,
                    openTime: "10:30", closeTime: "20:30" }
                : { dayOfWeek: day.dayOfWeek, isOpen: false },
        );
        const [week] = buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 9, null, configured,
        );

        expect(week?.columns.map(({ date }) => date)).toEqual([
            "2026-09-28",
            "2026-10-01",
            "2026-10-03",
        ]);
        expect(week?.displayStart).toBe("2026-09-28");
        expect(week?.displayEnd).toBe("2026-10-03");
    });

    it("keeps cross-month columns while scoping shift data to the selected month", () => {
        const [september] = buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 9, null, DEFAULT_STORE_HOURS,
        );
        const [october] = buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 10, null, DEFAULT_STORE_HOURS,
        );

        expect(september?.weekStart).toBe("2026-09-28");
        expect(october?.weekStart).toBe("2026-09-28");
        expect(september?.columns.find(({ date }) => date === "2026-10-01"))
            .toMatchObject({ inSelectedMonth: false });
        expect(september?.rows.flatMap(({ cells }) => cells)
            .flatMap(({ shifts }) => shifts).map(({ id }) => id)).not.toContain("oct-b");
        expect(october?.rows.flatMap(({ cells }) => cells)
            .flatMap(({ shifts }) => shifts).map(({ id }) => id)).toEqual(["oct-b"]);
    });

    it("can include only the adjacent dates of boundary weeks", () => {
        const shifts = [
            ...SHIFTS,
            { id: "oct-next", employeeId: "a", date: "2026-10-05", start: "09:00", end: "15:00" },
        ];
        const [week] = buildScheduleWeeks(
            shifts,
            EMPLOYEES,
            2026,
            9,
            null,
            DEFAULT_STORE_HOURS,
            { includeBoundaryWeekShifts: true },
        );

        expect(week?.columns.find(({ date }) => date === "2026-10-01"))
            .toMatchObject({ inSelectedMonth: false, inScheduleScope: true });
        expect(week?.rows.flatMap(({ cells }) => cells)
            .flatMap(({ shifts: cellShifts }) => cellShifts).map(({ id }) => id))
            .toContain("oct-b");
        expect(JSON.stringify(week)).not.toContain("oct-next");

        const [octoberBoundaryWeek] = buildScheduleWeeks(
            shifts,
            EMPLOYEES,
            2026,
            10,
            null,
            DEFAULT_STORE_HOURS,
            { includeBoundaryWeekShifts: true },
        );
        expect(octoberBoundaryWeek?.weekStart).toBe("2026-09-28");
        expect(octoberBoundaryWeek?.columns.find(({ date }) => date === "2026-09-28"))
            .toMatchObject({ inSelectedMonth: false, inScheduleScope: true });
        expect(octoberBoundaryWeek?.rows.flatMap(({ cells }) => cells)
            .flatMap(({ shifts: cellShifts }) => cellShifts).map(({ id }) => id))
            .toEqual(expect.arrayContaining([
                "sep-split", "sep-early-a", "sep-late", "sep-early-b", "oct-b",
            ]));
    });

    it("filters the matrix to one employee without a separate representation", () => {
        const weeks = buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 9, "a", DEFAULT_STORE_HOURS,
        );

        expect(weeks[0]?.rows.map(({ employeeId }) => employeeId)).toEqual(["a"]);
    });

    it("keeps inactive employees available when the displayed month references them", () => {
        expect(scheduleFilterEmployees(EMPLOYEES, SHIFTS, 2026, 9).map(({ id }) => id))
            .toEqual(["a", "b"]);
        expect(scheduleFilterEmployees(EMPLOYEES, [], 2026, 9).map(({ id }) => id))
            .toEqual(["a"]);
    });

    it("keeps employees with only a trailing-week shift available to Schedule", () => {
        expect(scheduleFilterEmployees(
            EMPLOYEES,
            [],
            2026,
            9,
            ["b"],
        ).map(({ id }) => id)).toEqual(["a", "b"]);
    });

    it("returns an empty projection for a month without shifts", () => {
        expect(buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 11, null, DEFAULT_STORE_HOURS,
        )).toEqual([]);
    });

    it("does not mutate canonical shifts, employees, or configured open days", () => {
        const shifts = structuredClone(SHIFTS);
        const employees = structuredClone(EMPLOYEES);
        const storeHours = cloneStoreHours(DEFAULT_STORE_HOURS);
        const before = JSON.stringify({ shifts, employees, storeHours });

        buildScheduleWeeks(shifts, employees, 2026, 9, null, storeHours);

        expect(JSON.stringify({ shifts, employees, storeHours })).toBe(before);
    });
});
