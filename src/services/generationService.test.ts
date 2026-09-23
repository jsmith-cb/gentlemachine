import { describe, expect, it } from "vitest";
import {
    classifyGenerationFlexibility,
    generateShifts,
    orderEmployeesForGeneration,
} from "./generationService";
import {
    getAdjustedWeeklyTargetMinutes,
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

    it("uses deterministic month-scoped shift identities", () => {
        const employees = [makeEmployee()];
        const march = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        const marchAgain = generateShifts(employees, [], STORE_HOURS, 2026, 3);
        const april = generateShifts(employees, [], STORE_HOURS, 2026, 4);

        expect(march.shifts.map(({ id }) => id)).toEqual(
            marchAgain.shifts.map(({ id }) => id),
        );
        expect(march.shifts[0]?.id).toBe("generated-shift-2026-03-1");
        expect(april.shifts[0]?.id).toBe("generated-shift-2026-04-1");
        expect(new Set([
            ...march.shifts.map(({ id }) => id),
            ...april.shifts.map(({ id }) => id),
        ])).toHaveLength(march.shifts.length + april.shifts.length);
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

    describe("weekly coverage allocation", () => {
        it("distributes work across every planning week", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 30 * 60,
                maxDaysPerWeek: 5,
                availability: { days: [1, 2, 3, 4, 5] },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3);
            const weeks = new Set(result.shifts.map(({ date }) => getWeekStartDate(date)));

            expect(weeks).toEqual(new Set([
                "2026-03-02",
                "2026-03-09",
                "2026-03-16",
                "2026-03-23",
                "2026-03-30",
            ]));
        });

        it("considers operating days through the end of the month", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 60 * 60,
                maxDaysPerWeek: 6,
                availability: { days: [1, 2, 3, 4, 5, 6] },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3);
            const scheduledDates = new Set(result.shifts.map(({ date }) => date));

            expect(scheduledDates.has("2026-03-02")).toBe(true);
            expect(scheduledDates.has("2026-03-31")).toBe(true);
        });

        it("attempts baseline coverage before stacking employees at opening", () => {
            const employees = [
                makeEmployee({ id: "a", employeeNumber: "a", weeklyTargetMinutes: 40 * 60 }),
                makeEmployee({ id: "b", employeeNumber: "b", weeklyTargetMinutes: 40 * 60 }),
            ];

            const result = generateShifts(employees, [], STORE_HOURS, 2026, 3);
            const monday = result.shifts.filter(({ date }) => date === "2026-03-02");

            expect(monday).toHaveLength(2);
            expect(monday.some(({ start }) => start !== STORE_HOURS.open)).toBe(true);
            expect(Math.min(...monday.map(({ start }) => timeToMinutes(start))))
                .toBe(timeToMinutes(STORE_HOURS.open));
            expect(Math.max(...monday.map(({ end }) => timeToMinutes(end))))
                .toBe(timeToMinutes(STORE_HOURS.close));
        });

        it("uses a constrained employee where they can contribute and flexibility later", () => {
            const constrained = makeEmployee({
                id: "constrained",
                employeeNumber: "c",
                weeklyTargetMinutes: 25 * 60,
                availability: { days: [1, 2, 3, 4, 5], earliestStart: "10:00", latestEnd: "15:00" },
            });
            const flexible = makeEmployee({
                id: "flexible",
                employeeNumber: "f",
                weeklyTargetMinutes: 30 * 60,
            });

            const result = generateShifts([flexible, constrained], [], STORE_HOURS, 2026, 3);
            const monday = result.shifts.filter(({ date }) => date === "2026-03-02");
            const constrainedShift = monday.find(({ employeeId }) => employeeId === constrained.id);
            const flexibleShift = monday.find(({ employeeId }) => employeeId === flexible.id);

            expect(constrainedShift).toBeDefined();
            expect(constrainedShift?.end).toBe("15:00");
            expect(flexibleShift).toBeDefined();
            expect(flexibleShift?.end).toBe(STORE_HOURS.close);
        });

        it("uses authoritative adjusted weekly targets without massively overscheduling", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 20 * 60,
                maxDaysPerWeek: 5,
                availability: { days: [1, 2, 3, 4, 5] },
            });
            const vacations: VacationPeriod[] = [{
                id: "vacation",
                employeeId: employee.id,
                startDate: "2026-03-09",
                endDate: "2026-03-10",
            }];

            const result = generateShifts([employee], vacations, STORE_HOURS, 2026, 3);
            for (const weekStart of new Set(result.shifts.map(({ date }) => getWeekStartDate(date)))) {
                const weekEndDate = new Date(`${weekStart}T00:00:00.000Z`);
                weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 5);
                const weekEnd = weekEndDate.toISOString().slice(0, 10);
                const paid = result.shifts
                    .filter(({ date }) => getWeekStartDate(date) === weekStart)
                    .reduce((sum, shift) => sum + getPaidShiftMinutes(shift), 0);
                expect(paid).toBeLessThanOrEqual(
                    getAdjustedWeeklyTargetMinutes(employee, vacations, weekStart, weekEnd),
                );
            }
        });

        it("leaves impossible coverage unresolved instead of violating availability", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 20 * 60,
                maxDaysPerWeek: 5,
                availability: {
                    days: [1, 2, 3, 4, 5],
                    earliestStart: "10:00",
                    latestEnd: "12:00",
                },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3);

            expect(result.shifts.length).toBeGreaterThan(0);
            expect(result.shifts.every(({ start, end }) => start === "10:00" && end === "12:00"))
                .toBe(true);
        });

        it("uses deterministic 30-minute boundaries and avoids tiny target-closing shifts", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 140,
                maxDaysPerWeek: 5,
                availability: { days: [1, 2, 3, 4, 5], earliestStart: "10:00", latestEnd: "15:00" },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3);

            expect(result.shifts.every((shift) =>
                timeToMinutes(shift.start) % 30 === 0 &&
                timeToMinutes(shift.end) % 30 === 0 &&
                getPaidShiftMinutes(shift) >= 120,
            )).toBe(true);
        });
    });
});
