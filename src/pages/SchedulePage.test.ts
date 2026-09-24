import { describe, expect, it } from "vitest";
import {
    buildScheduleWeeks,
    scheduleFilterEmployees,
} from "./SchedulePage";

import type { Employee, Shift } from "../types/planning";

const OPEN_DAYS = [1, 2, 3, 4, 5, 6];

function employee(id: string, status: Employee["status"] = "active"): Employee {
    return {
        id,
        employeeNumber: id,
        status,
        firstName: id === "a" ? "Alice" : "Ben",
        lastName: "Crew",
        weeklyTargetMinutes: 0,
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
            SHIFTS, EMPLOYEES, 2026, 9, null, OPEN_DAYS,
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
            SHIFTS, EMPLOYEES, 2026, 9, null, OPEN_DAYS,
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
        const [week] = buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 9, null, [1, 4, 6],
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
            SHIFTS, EMPLOYEES, 2026, 9, null, OPEN_DAYS,
        );
        const [october] = buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 10, null, OPEN_DAYS,
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

    it("filters the matrix to one employee without a separate representation", () => {
        const weeks = buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 9, "a", OPEN_DAYS,
        );

        expect(weeks[0]?.rows.map(({ employeeId }) => employeeId)).toEqual(["a"]);
    });

    it("keeps inactive employees available when the displayed month references them", () => {
        expect(scheduleFilterEmployees(EMPLOYEES, SHIFTS, 2026, 9).map(({ id }) => id))
            .toEqual(["a", "b"]);
        expect(scheduleFilterEmployees(EMPLOYEES, [], 2026, 9).map(({ id }) => id))
            .toEqual(["a"]);
    });

    it("returns an empty projection for a month without shifts", () => {
        expect(buildScheduleWeeks(
            SHIFTS, EMPLOYEES, 2026, 11, null, OPEN_DAYS,
        )).toEqual([]);
    });

    it("does not mutate canonical shifts, employees, or configured open days", () => {
        const shifts = structuredClone(SHIFTS);
        const employees = structuredClone(EMPLOYEES);
        const openDays = [...OPEN_DAYS];
        const before = JSON.stringify({ shifts, employees, openDays });

        buildScheduleWeeks(shifts, employees, 2026, 9, null, openDays);

        expect(JSON.stringify({ shifts, employees, openDays })).toBe(before);
    });
});
