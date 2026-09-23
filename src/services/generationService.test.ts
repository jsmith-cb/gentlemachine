import { describe, expect, it } from "vitest";
import {
    classifyGenerationFlexibility,
    generateShifts,
    orderEmployeesForGeneration,
} from "./generationService";
import {
    getAdjustedMonthlyTargetMinutes,
    getDayOfWeek,
    getPaidShiftMinutes,
    getWeekStartDate,
    timeToMinutes,
} from "./hoursService";
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
            expect(timeToMinutes(shift.end)).toBeLessThanOrEqual(timeToMinutes("17:00"));
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
            expect(timeToMinutes(shift.end)).toBeLessThanOrEqual(timeToMinutes("15:00"));
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
            expect(timeToMinutes(shift.end)).toBeLessThanOrEqual(timeToMinutes("20:00"));
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
                expect(timeToMinutes(shift.end)).toBeLessThanOrEqual(timeToMinutes("16:00"));
            } else {
                expect(shift.start).toBe("11:00");
                expect(timeToMinutes(shift.end)).toBeLessThanOrEqual(timeToMinutes("17:00"));
            }
        }
    });

    it("respects store opening hours when employee has no availability hours", () => {
        const employees = [makeEmployee()];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        for (const shift of result.shifts) {
            expect(shift.start).toBe(STORE_HOURS.open);
            expect(timeToMinutes(shift.end)).toBeLessThanOrEqual(timeToMinutes(STORE_HOURS.close));
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

    describe("flexibility ordering", () => {
        const hourly = makeEmployee({
            id: "hourly",
            availability: { days: [1, 2, 3, 4, 5, 6], latestEnd: "14:00" },
        });
        const daily = makeEmployee({
            id: "daily",
            availability: { days: [1, 2, 3] },
        });
        const general = makeEmployee({
            id: "general",
            availability: { days: [1, 2, 3, 4, 5, 6] },
        });

        it("classifies hour, day, and generally available employees directly", () => {
            expect(classifyGenerationFlexibility(hourly, STORE_HOURS)).toBe("hour-constrained");
            expect(classifyGenerationFlexibility(daily, STORE_HOURS)).toBe("day-constrained");
            expect(classifyGenerationFlexibility(general, STORE_HOURS)).toBe("general");
        });

        it("ranks hour-constrained, then day-constrained, then general", () => {
            expect(orderEmployeesForGeneration([general, daily, hourly], STORE_HOURS).map(({ id }) => id))
                .toEqual(["hourly", "daily", "general"]);
        });

        it("uses immutable employee identity as the deterministic tie-breaker", () => {
            const later = makeEmployee({ id: "z-employee", availability: general.availability });
            const earlier = makeEmployee({ id: "a-employee", availability: general.availability });
            expect(orderEmployeesForGeneration([later, earlier], STORE_HOURS).map(({ id }) => id))
                .toEqual(["a-employee", "z-employee"]);
        });
    });

    describe("target allocation", () => {
        it("approaches the employee target", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 5 * 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1, 2, 3, 4, 5],
                    earliestStart: "10:00",
                    latestEnd: "12:00",
                },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3);
            const paidMinutes = result.shifts.reduce(
                (sum, shift) => sum + getPaidShiftMinutes(shift),
                0,
            );

            const monthlyTarget = getAdjustedMonthlyTargetMinutes(employee, [], 2026, 3);
            expect(paidMinutes).toBeGreaterThan(0);
            expect(paidMinutes).toBeLessThanOrEqual(monthlyTarget);
            expect(monthlyTarget - paidMinutes).toBeLessThan(120);
        });

        it("does not overschedule when target can be met", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 5 * 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1, 2, 3, 4, 5],
                    earliestStart: "10:00",
                    latestEnd: "15:00",
                },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3);
            const paidMinutes = result.shifts.reduce(
                (sum, shift) => sum + getPaidShiftMinutes(shift), 0);
            const target = getAdjustedMonthlyTargetMinutes(employee, [], 2026, 3);
            expect(paidMinutes).toBeLessThanOrEqual(target);
            expect(result.shifts.some(({ end }) => end !== "15:00")).toBe(true);
        });

        it("stops under target rather than generating a final shift below two paid hours", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 140,
                maxDaysPerWeek: 5,
                availability: { days: [1, 2, 3, 4, 5], earliestStart: "10:00", latestEnd: "12:00" },
            });
            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3);
            const paidMinutes = result.shifts.reduce(
                (sum, shift) => sum + getPaidShiftMinutes(shift), 0);
            const target = getAdjustedMonthlyTargetMinutes(employee, [], 2026, 3);
            expect(target - paidMinutes).toBeGreaterThan(0);
            expect(target - paidMinutes).toBeLessThan(120);
            expect(result.shifts.every((shift) => getPaidShiftMinutes(shift) >= 120)).toBe(true);
        });

        it("uses the authoritative vacation-adjusted monthly target", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 35 * 60,
                maxDaysPerWeek: 5,
                availability: { days: [1, 2, 3, 4, 5] },
            });
            const vacations: VacationPeriod[] = [{
                id: "vacation", employeeId: employee.id,
                startDate: "2026-03-09", endDate: "2026-03-10",
            }];
            const result = generateShifts([employee], vacations, STORE_HOURS, 2026, 3);
            const paidMinutes = result.shifts.reduce(
                (sum, shift) => sum + getPaidShiftMinutes(shift), 0);
            const adjustedTarget = getAdjustedMonthlyTargetMinutes(employee, vacations, 2026, 3);
            expect(paidMinutes).toBeLessThanOrEqual(adjustedTarget);
            expect(adjustedTarget - paidMinutes).toBeLessThan(120);
        });

        it("does not violate availability when target cannot be met", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 20 * 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [6],
                    earliestStart: "10:00",
                    latestEnd: "12:00",
                },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3);
            for (const shift of result.shifts) {
                expect(shift.start).toBe("10:00");
                expect(shift.end).toBe("12:00");
                expect(getDayOfWeek(shift.date)).toBe(6);
            }
            expect(result.shifts.reduce((sum, shift) => sum + getPaidShiftMinutes(shift), 0))
                .toBeLessThan(getAdjustedMonthlyTargetMinutes(employee, [], 2026, 3));
        });

        it("does not violate maxDaysPerWeek when target cannot be met", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 40 * 60,
                maxDaysPerWeek: 2,
                availability: { days: [1, 2, 3, 4, 5, 6] },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3);
            const byWeek = new Map<string, Set<string>>();
            for (const shift of result.shifts) {
                const week = getWeekStartDate(shift.date);
                if (!byWeek.has(week)) byWeek.set(week, new Set());
                byWeek.get(week)!.add(shift.date);
            }
            for (const dates of byWeek.values()) {
                expect(dates.size).toBeLessThanOrEqual(2);
            }
            expect(result.shifts.reduce((sum, shift) => sum + getPaidShiftMinutes(shift), 0))
                .toBeLessThan(getAdjustedMonthlyTargetMinutes(employee, [], 2026, 3));
        });
    });
});
