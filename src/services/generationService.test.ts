import { describe, expect, it } from "vitest";
import {
    classifyGenerationFlexibility,
    findContractExtensionCandidate,
    generateShifts,
    orderEmployeesForGeneration,
} from "./generationService";
import {
    getAdjustedWeeklyTargetMinutes,
    getDayOfWeek,
    getPaidShiftMinutes,
    getShiftDurationMinutes,
    getWeekStartDate,
    timeToMinutes,
} from "./hoursService";
import type { Employee, StoreHours, VacationPeriod } from "../types/planning";
import { createInitialPlannerState } from "../state/plannerState";
import {
    DEFAULT_SCHEDULING_RULE_SETTINGS,
    evaluatePlanningRules,
} from "./schedulingRulesService";

const STORE_OPEN = "10:00";
const STORE_CLOSE = "20:00";
const EIGHT_HOUR_STORE_CLOSE = "18:00";
function storeHours(open: string, close: string): StoreHours {
    return {
        days: [
            { dayOfWeek: 0, isOpen: false },
            { dayOfWeek: 1, isOpen: true, openTime: open, closeTime: close },
            { dayOfWeek: 2, isOpen: true, openTime: open, closeTime: close },
            { dayOfWeek: 3, isOpen: true, openTime: open, closeTime: close },
            { dayOfWeek: 4, isOpen: true, openTime: open, closeTime: close },
            { dayOfWeek: 5, isOpen: true, openTime: open, closeTime: close },
            { dayOfWeek: 6, isOpen: true, openTime: open, closeTime: close },
        ],
    };
}
const STORE_HOURS = storeHours(STORE_OPEN, STORE_CLOSE);
const EIGHT_HOUR_STORE_HOURS = storeHours(STORE_OPEN, EIGHT_HOUR_STORE_CLOSE);

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
    return {
        id: "emp-1",
        employeeNumber: "001",
        status: "active",
        firstName: "Test",
        lastName: "Employee",
        weeklyTargetMinutes: 30 * 60,
        maximumPaidMinutesPerDay: 8 * 60,
        maxDaysPerWeek: 5,
        availability: { days: [1, 2, 3, 4, 5] },
        ...overrides,
    };
}

describe("generateShifts", () => {
    it("uses the configured minimum for new standalone generated shifts", () => {
        const employee = makeEmployee({
            weeklyTargetMinutes: 60,
            maxDaysPerWeek: 1,
            availability: { days: [1] },
        });
        const settings = structuredClone(DEFAULT_SCHEDULING_RULE_SETTINGS);
        settings.minimumGeneratedShiftMinutes = 60;

        const withOneHourMinimum = generateShifts(
            [employee], [], STORE_HOURS, 2026, 3, [], settings,
        );
        const withDefaultMinimum = generateShifts(
            [employee], [], STORE_HOURS, 2026, 3, [], DEFAULT_SCHEDULING_RULE_SETTINGS,
        );

        expect(withOneHourMinimum.shifts.some((shift) => getPaidShiftMinutes(shift) === 60))
            .toBe(true);
        expect(withDefaultMinimum.shifts).toEqual([]);
    });

    it("uses preferred-rule order lexicographically at a real placement choice", () => {
        const configured: StoreHours = {
            days: [
                { dayOfWeek: 0, isOpen: false },
                { dayOfWeek: 1, isOpen: true, openTime: "10:00", closeTime: "18:00" },
                { dayOfWeek: 2, isOpen: false }, { dayOfWeek: 3, isOpen: false },
                { dayOfWeek: 4, isOpen: false }, { dayOfWeek: 5, isOpen: false },
                { dayOfWeek: 6, isOpen: false },
            ],
        };
        const alreadyScheduled = makeEmployee({
            id: "existing-employee", employeeNumber: "existing", weeklyTargetMinutes: 4 * 60,
            maxDaysPerWeek: 1, availability: { days: [1] },
        });
        const candidate = makeEmployee({
            id: "candidate", employeeNumber: "candidate", weeklyTargetMinutes: 4 * 60,
            maxDaysPerWeek: 1, availability: { days: [1] },
        });
        const existing = [{
            id: "existing", employeeId: alreadyScheduled.id, date: "2026-03-02",
            start: "10:00", end: "14:00",
        }];
        const coverageFirst = structuredClone(DEFAULT_SCHEDULING_RULE_SETTINGS);
        coverageFirst.preferredOrder = [
            "opening-hours-coverage", "overlapping-shifts", "contracted-hours",
            "one-saturday-off-per-month", "employee-preferred-hours", "minimize-fragmentation",
        ];
        const overlapFirst = structuredClone(coverageFirst);
        overlapFirst.preferredOrder = [
            "overlapping-shifts", "opening-hours-coverage", "contracted-hours",
            "one-saturday-off-per-month", "employee-preferred-hours", "minimize-fragmentation",
        ];

        const coverageResult = generateShifts(
            [alreadyScheduled, candidate], [], configured, 2026, 3, existing, coverageFirst,
        );
        const overlapResult = generateShifts(
            [alreadyScheduled, candidate], [], configured, 2026, 3, existing, overlapFirst,
        );

        expect(coverageResult.shifts.find(({ employeeId }) => employeeId === candidate.id)?.start)
            .toBe("14:00");
        expect(overlapResult.shifts.find(({ employeeId }) => employeeId === candidate.id)?.start)
            .toBe("10:30");
    });

    it("lets a preferred Saturday off yield to or outrank coverage according to saved order", () => {
        const configured: StoreHours = {
            days: [
                { dayOfWeek: 0, isOpen: false },
                { dayOfWeek: 1, isOpen: true, openTime: "10:00", closeTime: "14:00" },
                { dayOfWeek: 2, isOpen: false }, { dayOfWeek: 3, isOpen: false },
                { dayOfWeek: 4, isOpen: false }, { dayOfWeek: 5, isOpen: false },
                { dayOfWeek: 6, isOpen: true, openTime: "10:00", closeTime: "14:00" },
            ],
        };
        const fullSaturday = makeEmployee({
            id: "a-full", employeeNumber: "a-full", weeklyTargetMinutes: 4 * 60,
            maxDaysPerWeek: 1, availability: {
                days: [1, 6], earliestStart: "10:00", latestEnd: "14:00",
            },
        });
        const partialSaturday = makeEmployee({
            id: "b-partial", employeeNumber: "b-partial", weeklyTargetMinutes: 2 * 60,
            maxDaysPerWeek: 1, availability: {
                days: [1, 6], earliestStart: "10:00", latestEnd: "12:00",
            },
        });
        const existing = [{
            id: "monday-cover", employeeId: "outside-schedule", date: "2026-03-02",
            start: "10:00", end: "14:00",
        }];
        const coverageFirst = structuredClone(DEFAULT_SCHEDULING_RULE_SETTINGS);
        coverageFirst.preferredOrder = [
            "opening-hours-coverage", "contracted-hours", "one-saturday-off-per-month",
            "overlapping-shifts", "employee-preferred-hours", "minimize-fragmentation",
        ];
        const saturdayFirst = structuredClone(coverageFirst);
        saturdayFirst.preferredOrder = [
            "one-saturday-off-per-month", "opening-hours-coverage", "contracted-hours",
            "overlapping-shifts", "employee-preferred-hours", "minimize-fragmentation",
        ];

        const coverageResult = generateShifts(
            [fullSaturday, partialSaturday], [], configured, 2026, 3, existing, coverageFirst,
        );
        const saturdayResult = generateShifts(
            [fullSaturday, partialSaturday], [], configured, 2026, 3, existing, saturdayFirst,
        );
        const firstSaturday = "2026-03-07";

        expect(coverageResult.shifts).toContainEqual(expect.objectContaining({
            employeeId: fullSaturday.id, date: firstSaturday,
        }));
        expect(saturdayResult.shifts).not.toContainEqual(expect.objectContaining({
            employeeId: fullSaturday.id, date: firstSaturday,
        }));
        expect(saturdayResult.shifts).toContainEqual(expect.objectContaining({
            employeeId: partialSaturday.id, date: firstSaturday,
        }));
    });

    describe("employee daily paid-hours maximum", () => {
        it("counts existing scheduled time and does not add work beyond remaining daily capacity", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 40 * 60,
                maximumPaidMinutesPerDay: 3 * 60,
                availability: { days: [1, 2, 3, 4, 5] },
            });
            const existing = [{
                id: "existing", employeeId: employee.id, date: "2026-03-02",
                start: "10:00", end: "12:00",
            }];

            const result = generateShifts(
                [employee], [], STORE_HOURS, 2026, 3, existing,
            );
            const mondayPaid = [...existing, ...result.shifts]
                .filter(({ date }) => date === "2026-03-02")
                .reduce((total, shift) => total + getPaidShiftMinutes(shift), 0);

            expect(mondayPaid).toBeLessThanOrEqual(employee.maximumPaidMinutesPerDay!);
        });

        it("leaves coverage short rather than exceeding the employee maximum", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 40 * 60,
                maximumPaidMinutesPerDay: 2 * 60,
                maxDaysPerWeek: 5,
            });
            const result = generateShifts(
                [employee], [], EIGHT_HOUR_STORE_HOURS, 2026, 3, [],
            );
            const firstMonday = result.shifts.filter(({ date }) => date === "2026-03-02");
            expect(firstMonday.reduce(
                (total, shift) => total + getPaidShiftMinutes(shift), 0,
            )).toBeLessThanOrEqual(2 * 60);
            expect(firstMonday.some(({ end }) => end === EIGHT_HOUR_STORE_CLOSE)).toBe(false);
        });

        it("does not exceed the daily maximum while fulfilling target hours", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 40 * 60,
                maximumPaidMinutesPerDay: 3 * 60,
                maxDaysPerWeek: 6,
                availability: { days: [1, 2, 3, 4, 5, 6] },
            });
            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);
            const paidByDate = new Map<string, number>();
            for (const shift of result.shifts) {
                paidByDate.set(
                    shift.date,
                    (paidByDate.get(shift.date) ?? 0) + getPaidShiftMinutes(shift),
                );
            }
            expect([...paidByDate.values()].every((minutes) => minutes <= 3 * 60)).toBe(true);
        });
    });

    it("uses the shared Saturday rule to protect an applicable Saturday when coverage permits", () => {
        const configured: StoreHours = {
            days: [
                { dayOfWeek: 0, isOpen: false },
                { dayOfWeek: 1, isOpen: true, openTime: "10:00", closeTime: "12:00" },
                ...([2, 3, 4, 5] as const).map((dayOfWeek) => ({ dayOfWeek, isOpen: false as const })),
                { dayOfWeek: 6, isOpen: true, openTime: "10:00", closeTime: "12:00" },
            ],
        };
        const employees = [
            makeEmployee({ id: "a", employeeNumber: "a", weeklyTargetMinutes: 4 * 60,
                availability: { days: [1, 6] } }),
            makeEmployee({ id: "b", employeeNumber: "b", weeklyTargetMinutes: 4 * 60,
                availability: { days: [1, 6] } }),
        ];
        const settings = structuredClone(DEFAULT_SCHEDULING_RULE_SETTINGS);
        settings.modes["one-saturday-off-per-month"] = "require";

        const result = generateShifts(
            employees, [], configured, 2026, 3, [], settings,
        );
        const state = createInitialPlannerState(
            result.shifts, employees, [], configured, settings,
        );
        state.selectedYear = 2026; state.selectedMonth = 3;

        expect(evaluatePlanningRules(state).filter(({ rule }) =>
            rule === "one-saturday-off-per-month")).toEqual([]);
    });

    it("uses configured operating days and per-day hours", () => {
        const configured = storeHours("10:00", "20:00");
        configured.days = configured.days.map((day) => day.dayOfWeek === 1
            ? { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "18:00" }
            : day.dayOfWeek === 3
                ? { dayOfWeek: 3, isOpen: false }
                : day);
        const employee = makeEmployee({
            weeklyTargetMinutes: 60 * 60,
            maxDaysPerWeek: 6,
            availability: { days: [1, 2, 3, 4, 5, 6] },
        });

        const result = generateShifts([employee], [], configured, 2026, 3, []);

        expect(result.shifts.some(({ date }) => getDayOfWeek(date) === 3)).toBe(false);
        const monday = result.shifts.find(({ date }) => date === "2026-03-02");
        expect(monday?.start).toBe("09:00");
        expect(timeToMinutes(monday!.end)).toBeLessThanOrEqual(timeToMinutes("18:00"));
    });
    it("never generates a shift longer than eight hours", () => {
        const employee = makeEmployee({
            weeklyTargetMinutes: 60 * 60,
            maxDaysPerWeek: 6,
            availability: { days: [1, 2, 3, 4, 5, 6] },
        });

        const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);

        expect(result.shifts.every((shift) => getShiftDurationMinutes(shift) <= 8 * 60))
            .toBe(true);
    });
    it("produces shifts for active eligible employees", () => {
        const employees = [makeEmployee()];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
        expect(result.shifts.length).toBeGreaterThan(0);
        const marchShifts = result.shifts.filter((s) => s.date.startsWith("2026-03"));
        expect(marchShifts.length).toBeGreaterThan(0);
    });

    it("does not produce shifts for inactive employees", () => {
        const employees = [makeEmployee({ status: "inactive" })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
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
        const result = generateShifts(employees, [vacation], STORE_HOURS, 2026, 3, []);
        const vacationShifts = result.shifts.filter(
            (s) => s.employeeId === "emp-1" && s.date >= "2026-03-10" && s.date <= "2026-03-14",
        );
        expect(vacationShifts).toEqual([]);
    });

    it("does not schedule on unavailable days", () => {
        const employees = [makeEmployee({ availability: { days: [1, 2] } })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
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
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
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
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
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
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
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
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
        expect(result.shifts).toEqual([]);
    });

    it("uses day-specific hours as preferred placement when practical", () => {
        const employees = [makeEmployee({
            weeklyTargetMinutes: 6 * 60,
            maxDaysPerWeek: 2,
            availability: {
                days: [1, 2],
                earliestStart: "11:00",
                latestEnd: "17:00",
                dayHours: {
                    1: { earliestStart: "12:00", latestEnd: "16:00" },
                },
            },
        })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
        for (const shift of result.shifts) {
            const dow = getDayOfWeek(shift.date);
            if (dow === 1) {
                expect(timeToMinutes(shift.start)).toBeGreaterThanOrEqual(timeToMinutes("12:00"));
                expect(timeToMinutes(shift.end)).toBeLessThanOrEqual(timeToMinutes("16:00"));
            } else {
                expect(shift.start).toBe("11:00");
                expect(timeToMinutes(shift.end)).toBeLessThanOrEqual(timeToMinutes("17:00"));
            }
        }
    });

    it("respects store opening hours when employee has no availability hours", () => {
        const employees = [makeEmployee()];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
        for (const shift of result.shifts) {
            expect(shift.start).toBe(STORE_OPEN);
            expect(timeToMinutes(shift.end)).toBeLessThanOrEqual(timeToMinutes(STORE_CLOSE));
        }
    });

    it("respects maximum working days per week", () => {
        const employees = [makeEmployee({ maxDaysPerWeek: 2, availability: { days: [1, 2, 3, 4, 5] } })];
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
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
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
        for (const shift of result.shifts) {
            expect(getDayOfWeek(shift.date)).toBe(6);
        }
    });

    it("is deterministic", () => {
        const employees = [
            makeEmployee({ id: "emp-1" }),
            makeEmployee({ id: "emp-2", employeeNumber: "002" }),
        ];
        const result1 = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
        const result2 = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
        expect(result1.shifts).toEqual(result2.shifts);
    });

    it("uses deterministic month-scoped shift identities", () => {
        const employees = [makeEmployee()];
        const march = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
        const marchAgain = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
        const april = generateShifts(employees, [], STORE_HOURS, 2026, 4, []);

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
        const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
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
        generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
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

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);
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

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);
            const scheduledDates = new Set(result.shifts.map(({ date }) => date));

            expect(scheduledDates.has("2026-03-02")).toBe(true);
            expect(scheduledDates.has("2026-03-31")).toBe(true);
        });

        it("covers the baseline without unnecessary stacking at opening", () => {
            const employees = [
                makeEmployee({ id: "a", employeeNumber: "a", weeklyTargetMinutes: 40 * 60 }),
                makeEmployee({ id: "b", employeeNumber: "b", weeklyTargetMinutes: 40 * 60 }),
            ];

            const result = generateShifts(employees, [], STORE_HOURS, 2026, 3, []);
            const monday = result.shifts.filter(({ date }) => date === "2026-03-02");

            expect(monday).toHaveLength(2);
            expect(monday.some(({ start }) => start !== STORE_OPEN)).toBe(true);
            expect(Math.min(...monday.map(({ start }) => timeToMinutes(start))))
                .toBe(timeToMinutes(STORE_OPEN));
            expect(Math.max(...monday.map(({ end }) => timeToMinutes(end))))
                .toBe(timeToMinutes(STORE_CLOSE));
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

            const result = generateShifts([flexible, constrained], [], STORE_HOURS, 2026, 3, []);
            const monday = result.shifts.filter(({ date }) => date === "2026-03-02");
            const constrainedShift = monday.find(({ employeeId }) => employeeId === constrained.id);
            const flexibleShift = monday.find(({ employeeId }) => employeeId === flexible.id);

            expect(constrainedShift).toBeDefined();
            expect(constrainedShift?.end).toBe("15:00");
            expect(flexibleShift).toBeDefined();
            expect(flexibleShift?.end).toBe(STORE_CLOSE);
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

            const result = generateShifts([employee], vacations, STORE_HOURS, 2026, 3, []);
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

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);

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

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);

            expect(result.shifts.every((shift) =>
                timeToMinutes(shift.start) % 30 === 0 &&
                timeToMinutes(shift.end) % 30 === 0 &&
                getPaidShiftMinutes(shift) >= 120,
            )).toBe(true);
        });
    });

    describe("generated weekly target ceiling", () => {
        it("leaves coverage unresolved rather than exceeding the adjusted weekly target", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 6 * 60,
                maxDaysPerWeek: 1,
                availability: { days: [1] },
            });

            const result = generateShifts([employee], [], EIGHT_HOUR_STORE_HOURS, 2026, 3, []);
            const firstMonday = result.shifts.find(({ date }) => date === "2026-03-02");

            expect(firstMonday).toBeDefined();
            expect(getPaidShiftMinutes(firstMonday!)).toBeLessThanOrEqual(
                employee.weeklyTargetMinutes,
            );
            expect(firstMonday?.end).not.toBe(EIGHT_HOUR_STORE_CLOSE);
        });

        it("may complete coverage when doing so stays within the weekly target", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 7 * 60,
                maxDaysPerWeek: 1,
                availability: { days: [1] },
            });

            const result = generateShifts([employee], [], EIGHT_HOUR_STORE_HOURS, 2026, 3, []);
            const shift = result.shifts.find(({ date }) => date === "2026-03-02");

            expect(shift).toMatchObject({ start: "10:00", end: "18:00" });
            expect(getPaidShiftMinutes(shift!)).toBe(employee.weeklyTargetMinutes);
        });

        it("does not use target overage to close a substantial coverage gap", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 4 * 60,
                maxDaysPerWeek: 1,
                availability: { days: [1] },
            });

            const result = generateShifts([employee], [], EIGHT_HOUR_STORE_HOURS, 2026, 3, []);
            const shift = result.shifts.find(({ date }) => date === "2026-03-02");

            expect(shift?.end).not.toBe(EIGHT_HOUR_STORE_CLOSE);
            expect(getPaidShiftMinutes(shift!)).toBeLessThanOrEqual(employee.weeklyTargetMinutes);
        });

        it("never extends beyond legal availability", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 6 * 60,
                maxDaysPerWeek: 1,
                availability: { days: [1], earliestStart: "10:00", latestEnd: "19:00" },
            });

            const result = generateShifts([employee], [], EIGHT_HOUR_STORE_HOURS, 2026, 3, []);

            expect(result.shifts.every(({ end }) => timeToMinutes(end) <= timeToMinutes("19:00")))
                .toBe(true);
        });

        it("uses vacation-adjusted full-week targets across partial month weeks", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 20 * 60,
                maxDaysPerWeek: 5,
                availability: { days: [1, 2, 3, 4, 5] },
            });
            const vacations: VacationPeriod[] = [{
                id: "vacation",
                employeeId: employee.id,
                startDate: "2026-03-09",
                endDate: "2026-03-13",
            }];

            const result = generateShifts(
                [employee], vacations, STORE_HOURS, 2026, 3, [],
            );
            const paidByWeek = new Map<string, number>();
            for (const shift of result.shifts) {
                const weekStart = getWeekStartDate(shift.date);
                paidByWeek.set(
                    weekStart,
                    (paidByWeek.get(weekStart) ?? 0) + getPaidShiftMinutes(shift),
                );
            }
            for (const [weekStart, paid] of paidByWeek) {
                const weekEnd = new Date(`${weekStart}T00:00:00Z`);
                weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
                expect(paid).toBeLessThanOrEqual(getAdjustedWeeklyTargetMinutes(
                    employee, vacations, weekStart, weekEnd.toISOString().slice(0, 10),
                ));
            }
        });
    });

    describe("preferred hours", () => {
        it("places generated work inside day-specific preferred hours when practical", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 330,
                maxDaysPerWeek: 1,
                availability: {
                    days: [1],
                    earliestStart: "10:00",
                    latestEnd: "20:00",
                    dayHours: { 1: { earliestStart: "12:00", latestEnd: "18:00" } },
                },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);
            const shift = result.shifts.find(({ date }) => date === "2026-03-02");

            expect(shift).toMatchObject({ start: "12:00", end: "18:00" });
        });

        it("clips preferred placement to legal availability", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 330,
                maxDaysPerWeek: 1,
                availability: {
                    days: [1],
                    earliestStart: "10:00",
                    latestEnd: "17:00",
                    dayHours: { 1: { earliestStart: "12:00", latestEnd: "18:00" } },
                },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);

            expect(result.shifts.every(({ end }) => timeToMinutes(end) <= timeToMinutes("17:00")))
                .toBe(true);
        });

        it("may leave preferred hours to satisfy baseline coverage", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 8 * 60,
                maxDaysPerWeek: 1,
                availability: {
                    days: [1],
                    earliestStart: "10:00",
                    latestEnd: "20:00",
                    dayHours: { 1: { earliestStart: "12:00", latestEnd: "18:00" } },
                },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);
            const shift = result.shifts.find(({ date }) => date === "2026-03-02");

            expect(shift).toMatchObject({ start: "10:00", end: "18:00" });
        });

        it("remains deterministic with preferred-hour placement", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 330,
                maxDaysPerWeek: 1,
                availability: {
                    days: [1],
                    dayHours: { 1: { earliestStart: "12:00", latestEnd: "18:00" } },
                },
            });

            expect(generateShifts([employee], [], STORE_HOURS, 2026, 3, []))
                .toEqual(generateShifts([employee], [], STORE_HOURS, 2026, 3, []));
        });
    });

    describe("cross-month weekly boundaries", () => {
        const boundaryEmployee = makeEmployee({
            weeklyTargetMinutes: 40 * 60,
            maxDaysPerWeek: 5,
            availability: { days: [1, 2, 3, 4, 5, 6] },
        });

        it("counts next-month shifts when generating the previous month", () => {
            const existing = [
                { id: "oct-1", employeeId: boundaryEmployee.id, date: "2026-10-01", start: "10:00", end: "18:00" },
                { id: "oct-2", employeeId: boundaryEmployee.id, date: "2026-10-02", start: "10:00", end: "18:00" },
                { id: "oct-3", employeeId: boundaryEmployee.id, date: "2026-10-03", start: "10:00", end: "18:00" },
            ];
            const original = JSON.stringify(existing);

            const result = generateShifts(
                [boundaryEmployee], [], STORE_HOURS, 2026, 9, existing,
            );
            const boundaryWeek = result.shifts.filter(
                ({ date }) => getWeekStartDate(date) === "2026-09-28",
            );

            expect(boundaryWeek).toHaveLength(2);
            expect(result.shifts.every(({ date }) => date.startsWith("2026-09-"))).toBe(true);
            expect(JSON.stringify(existing)).toBe(original);
        });

        it("counts previous-month shifts when generating the following month", () => {
            const existing = [
                { id: "sep-28", employeeId: boundaryEmployee.id, date: "2026-09-28", start: "10:00", end: "18:00" },
                { id: "sep-29", employeeId: boundaryEmployee.id, date: "2026-09-29", start: "10:00", end: "18:00" },
                { id: "sep-30", employeeId: boundaryEmployee.id, date: "2026-09-30", start: "10:00", end: "18:00" },
            ];

            const result = generateShifts(
                [boundaryEmployee], [], STORE_HOURS, 2026, 10, existing,
            );
            const boundaryWeek = result.shifts.filter(
                ({ date }) => getWeekStartDate(date) === "2026-09-28",
            );

            expect(boundaryWeek).toHaveLength(2);
            expect(result.shifts.every(({ date }) => date.startsWith("2026-10-"))).toBe(true);
        });

        it("includes outside-month paid time in weekly target accounting", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 14 * 60,
                maxDaysPerWeek: 5,
                availability: { days: [1, 2, 3, 4, 5, 6] },
            });
            const existing = [
                { id: "sep-28", employeeId: employee.id, date: "2026-09-28", start: "10:00", end: "18:00" },
                { id: "sep-29", employeeId: employee.id, date: "2026-09-29", start: "10:00", end: "18:00" },
            ];

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 10, existing);

            expect(result.shifts.some(
                ({ date }) => date >= "2026-10-01" && date <= "2026-10-03",
            )).toBe(false);
        });
    });

    describe("post-coverage contract fulfillment", () => {
        it("extends an existing shift for a 30-minute remaining target", () => {
            const employee = makeEmployee();
            const shift = {
                id: "generated",
                employeeId: employee.id,
                date: "2026-03-02",
                start: "10:00",
                end: "13:00",
            };

            const candidate = findContractExtensionCandidate(
                employee, STORE_HOURS, shift, 30,
            );

            expect(candidate).not.toBeNull();
            expect(getPaidShiftMinutes(candidate!) - getPaidShiftMinutes(shift)).toBe(30);
        });

        it("extends an existing shift for a 60-minute remaining target", () => {
            const employee = makeEmployee();
            const shift = {
                id: "generated",
                employeeId: employee.id,
                date: "2026-03-02",
                start: "10:00",
                end: "13:00",
            };

            const candidate = findContractExtensionCandidate(
                employee, STORE_HOURS, shift, 60,
            );

            expect(candidate).not.toBeNull();
            expect(getPaidShiftMinutes(candidate!) - getPaidShiftMinutes(shift)).toBe(60);
        });

        it("uses authoritative paid time when an extension crosses a break threshold", () => {
            const employee = makeEmployee();
            const shift = {
                id: "generated",
                employeeId: employee.id,
                date: "2026-03-02",
                start: "10:00",
                end: "14:30",
            };

            const candidate = findContractExtensionCandidate(
                employee, STORE_HOURS, shift, 15,
            );

            expect(candidate).toMatchObject({ start: "10:00", end: "15:00" });
            expect(getPaidShiftMinutes(candidate!) - getPaidShiftMinutes(shift)).toBe(15);
        });

        it("does not extend past the remaining target, legal window, or eight-hour limit", () => {
            const employee = makeEmployee({
                availability: {
                    days: [1, 2, 3, 4, 5],
                    earliestStart: "10:00",
                    latestEnd: "18:00",
                },
            });
            const shift = {
                id: "generated",
                employeeId: employee.id,
                date: "2026-03-02",
                start: "10:00",
                end: "17:30",
            };

            const candidate = findContractExtensionCandidate(
                employee, STORE_HOURS, shift, 30,
            );

            expect(candidate).toMatchObject({ start: "10:00", end: "18:00" });
            expect(getShiftDurationMinutes(candidate!)).toBe(8 * 60);
            expect(getPaidShiftMinutes(candidate!) - getPaidShiftMinutes(shift)).toBeLessThanOrEqual(30);
            expect(findContractExtensionCandidate(employee, STORE_HOURS, candidate!, 30)).toBeNull();
        });

        it("continues allocating meaningful work after baseline coverage is complete", () => {
            const coverageEmployee = makeEmployee({
                id: "coverage",
                employeeNumber: "coverage",
                weeklyTargetMinutes: 35 * 60,
            });
            const underTarget = makeEmployee({
                id: "under-target",
                employeeNumber: "under-target",
                weeklyTargetMinutes: 14 * 60,
            });

            const result = generateShifts(
                [coverageEmployee, underTarget], [], STORE_HOURS, 2026, 3, [],
            );
            const underTargetShifts = result.shifts.filter(
                ({ employeeId }) => employeeId === underTarget.id,
            );

            expect(underTargetShifts.length).toBeGreaterThan(0);
            expect(underTargetShifts.some((shift) =>
                result.shifts.some((other) => other.id !== shift.id && other.date === shift.date),
            )).toBe(true);
        });

        it("does not create tiny shifts merely to eliminate a small target remainder", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 90,
                maxDaysPerWeek: 5,
                availability: { days: [1, 2, 3, 4, 5] },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);

            expect(result.shifts).toEqual([]);
        });

        it("leaves an unavoidable deficit rather than violating maximum days or shift duration", () => {
            const employee = makeEmployee({
                weeklyTargetMinutes: 40 * 60,
                maxDaysPerWeek: 1,
                availability: { days: [1, 2, 3, 4, 5] },
            });

            const result = generateShifts([employee], [], STORE_HOURS, 2026, 3, []);
            const week = result.shifts.filter(({ date }) => getWeekStartDate(date) === "2026-03-02");

            expect(new Set(week.map(({ date }) => date))).toHaveLength(1);
            expect(week.every((shift) => getShiftDurationMinutes(shift) <= 8 * 60)).toBe(true);
            expect(week.reduce((total, shift) => total + getPaidShiftMinutes(shift), 0))
                .toBeLessThan(employee.weeklyTargetMinutes);
        });
    });

    describe("flexibility-preserving placement", () => {
        it("uses an earlier-ending employee for early coverage and preserves flexibility for closing", () => {
            const early = makeEmployee({
                id: "early",
                employeeNumber: "early",
                weeklyTargetMinutes: 25 * 60,
                availability: { days: [1, 2, 3, 4, 5], earliestStart: "10:00", latestEnd: "17:00" },
            });
            const flexible = makeEmployee({
                id: "flexible",
                employeeNumber: "flexible",
                weeklyTargetMinutes: 25 * 60,
                availability: { days: [1, 2, 3, 4, 5], earliestStart: "10:00", latestEnd: "20:00" },
            });

            const result = generateShifts([flexible, early], [], STORE_HOURS, 2026, 3, []);
            const monday = result.shifts.filter(({ date }) => date === "2026-03-02");
            const earlyShift = monday.find(({ employeeId }) => employeeId === early.id);
            const flexibleShift = monday.find(({ employeeId }) => employeeId === flexible.id);

            expect(earlyShift?.start).toBe(STORE_OPEN);
            expect(timeToMinutes(earlyShift!.end)).toBeLessThanOrEqual(timeToMinutes("17:00"));
            expect(flexibleShift?.end).toBe(STORE_CLOSE);
        });

        it("uses a later-starting employee for suitable later coverage", () => {
            const flexible = makeEmployee({
                id: "flexible",
                employeeNumber: "flexible",
                weeklyTargetMinutes: 20 * 60,
            });
            const late = makeEmployee({
                id: "late",
                employeeNumber: "late",
                weeklyTargetMinutes: 20 * 60,
                availability: { days: [1, 2, 3, 4, 5], earliestStart: "12:00", latestEnd: "20:00" },
            });

            const result = generateShifts([late, flexible], [], STORE_HOURS, 2026, 3, []);
            const lateShift = result.shifts.find(
                ({ employeeId, date }) => employeeId === late.id && date === "2026-03-02",
            );

            expect(timeToMinutes(lateShift!.start)).toBeGreaterThan(timeToMinutes(STORE_OPEN));
            expect(lateShift?.end).toBe(STORE_CLOSE);
        });
    });
});
