import { describe, expect, it } from "vitest";
import { generateShifts } from "./generationService";
import { getDayOfWeek, getWeekStartDate } from "./hoursService";
import type { Employee, StoreHours, VacationPeriod } from "../types/planning";

const STORE_HOURS: StoreHours = { open: "10:00", close: "20:00" };

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
    return {
        id: "emp-1",
        employeeNumber: "001",
        status: "active",
        firstName: "Test",
        lastName: "Employee",
        weeklyTargetMinutes: 30 * 60,
        maxDaysPerWeek: 5,
        availability: { days: [1, 2, 3, 4, 5] },
        ...overrides,
    };
}

describe("generateShifts", () => {
    it("produces shifts for active eligible employees", () => {
        const employees = [makeEmployee()];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        expect(result.shifts.length).toBeGreaterThan(0);
        const marchShifts = result.shifts.filter((s) => s.date.startsWith("2026-03"));
        expect(marchShifts.length).toBeGreaterThan(0);
    });

    it("does not produce shifts for inactive employees", () => {
        const employees = [makeEmployee({ status: "inactive" })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        expect(result.shifts).toEqual([]);
    });

    it("does not produce shifts on vacation days", () => {
        const employees = [makeEmployee()];
        const vacation: VacationPeriod = {
            id: "vac-1",
            employeeId: "emp-1",
            startDate: "2026-03-10",
            endDate: "2026-03-14",
        };
        const result = generateShifts(employees, [vacation], STORE_HOURS, 2026, 3);
        const vacationShifts = result.shifts.filter(
            (s) => s.employeeId === "emp-1" && s.date >= "2026-03-10" && s.date <= "2026-03-14",
        );
        expect(vacationShifts).toEqual([]);
    });

    it("does not schedule on unavailable days", () => {
        const employees = [makeEmployee({ availability: { days: [1, 2] } })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        const invalidDayShifts = result.shifts.filter((s) => {
            const dow = getDayOfWeek(s.date);
            return ![1, 2].includes(dow);
        });
        expect(invalidDayShifts).toEqual([]);
    });

    it("respects employee availability hours", () => {
        const employees = [makeEmployee({
            availability: {
                days: [1, 2, 3, 4, 5],
                earliestStart: "11:00",
                latestEnd: "17:00",
            },
        })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        for (const shift of result.shifts) {
            expect(shift.start).toBe("11:00");
            expect(shift.end).toBe("17:00");
        }
    });

    it("clips availability beginning before store opening", () => {
        const employees = [makeEmployee({
            availability: {
                days: [1, 2, 3, 4, 5],
                earliestStart: "09:00",
                latestEnd: "15:00",
            },
        })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        for (const shift of result.shifts) {
            expect(shift.start).toBe("10:00");
            expect(shift.end).toBe("15:00");
        }
    });

    it("clips availability ending after store closing", () => {
        const employees = [makeEmployee({
            availability: {
                days: [1, 2, 3, 4, 5],
                earliestStart: "16:00",
                latestEnd: "22:00",
            },
        })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        for (const shift of result.shifts) {
            expect(shift.start).toBe("16:00");
            expect(shift.end).toBe("20:00");
        }
    });

    it("does not generate a shift when availability and store hours do not overlap", () => {
        const employees = [makeEmployee({
            availability: {
                days: [1, 2, 3, 4, 5],
                earliestStart: "21:00",
                latestEnd: "23:00",
            },
        })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        expect(result.shifts).toEqual([]);
    });

    it("respects day-specific availability hours", () => {
        const employees = [makeEmployee({
            availability: {
                days: [1, 2],
                earliestStart: "11:00",
                latestEnd: "17:00",
                dayHours: {
                    1: { earliestStart: "12:00", latestEnd: "16:00" },
                },
            },
        })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        for (const shift of result.shifts) {
            const dow = getDayOfWeek(shift.date);
            if (dow === 1) {
                expect(shift.start).toBe("12:00");
                expect(shift.end).toBe("16:00");
            } else {
                expect(shift.start).toBe("11:00");
                expect(shift.end).toBe("17:00");
            }
        }
    });

    it("respects store opening hours when employee has no availability hours", () => {
        const employees = [makeEmployee()];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        for (const shift of result.shifts) {
            expect(shift.start).toBe(STORE_HOURS.open);
            expect(shift.end).toBe(STORE_HOURS.close);
        }
    });

    it("respects maximum working days per week", () => {
        const employees = [makeEmployee({ maxDaysPerWeek: 2, availability: { days: [1, 2, 3, 4, 5] } })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        const byWeek = new Map<string, Set<string>>();
        for (const shift of result.shifts) {
            const week = getWeekStartDate(shift.date);
            if (!byWeek.has(week)) byWeek.set(week, new Set());
            byWeek.get(week)!.add(shift.date);
        }
        for (const dates of byWeek.values()) {
            expect(dates.size).toBeLessThanOrEqual(2);
        }
    });

    it("does not violate hard constraints when targets cannot be met", () => {
        const employees = [makeEmployee({
            availability: { days: [6] },
            maxDaysPerWeek: 1,
        })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        for (const shift of result.shifts) {
            expect(getDayOfWeek(shift.date)).toBe(6);
        }
    });

    it("is deterministic", () => {
        const employees = [
            makeEmployee({ id: "emp-1" }),
            makeEmployee({ id: "emp-2", employeeNumber: "002" }),
        ];
        const result1 = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        const result2 = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        expect(result1.shifts).toEqual(result2.shifts);
    });

    it("produces canonical Shift objects", () => {
        const employees = [makeEmployee()];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        for (const shift of result.shifts) {
            expect(shift).toHaveProperty("id");
            expect(shift).toHaveProperty("employeeId");
            expect(shift).toHaveProperty("date");
            expect(shift).toHaveProperty("start");
            expect(shift).toHaveProperty("end");
            expect(typeof shift.id).toBe("string");
            expect(typeof shift.employeeId).toBe("string");
            expect(typeof shift.date).toBe("string");
            expect(typeof shift.start).toBe("string");
            expect(typeof shift.end).toBe("string");
        }
    });

    it("leaves employee configuration unchanged", () => {
        const employee = makeEmployee();
        const original = JSON.stringify(employee);
        const employees = [employee];
        generateShifts(employees, [], STORE_HOURS, 2026, 3);
        expect(JSON.stringify(employee)).toBe(original);
    });
});