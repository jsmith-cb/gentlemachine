import { describe, expect, it } from "vitest";

import {
    buildScheduleExportDocument,
    decideWeekPagination,
    employeeScheduleExportFilename,
    scheduleExportFilename,
} from "./scheduleExportService";
import { cloneStoreHours, DEFAULT_STORE_HOURS } from "./storeHoursService";

import type { Employee, Shift } from "../types/planning";

const EMPLOYEES: Employee[] = [
    {
        id: "employee-a",
        employeeNumber: "A-1",
        status: "active",
        firstName: "Avery",
        lastName: "North",
        email: "avery@example.invalid",
        weeklyTargetMinutes: 0,
        maxDaysPerWeek: 5,
        availability: { days: [1, 2, 3, 4, 5] },
    },
    {
        id: "employee-b",
        employeeNumber: "B-1",
        status: "active",
        firstName: "Blake",
        lastName: "West",
        email: "blake@example.invalid",
        weeklyTargetMinutes: 0,
        maxDaysPerWeek: 5,
        availability: { days: [1, 2, 3, 4, 5] },
    },
];

const SHIFTS: Shift[] = [
    { id: "a-sep", employeeId: "employee-a", date: "2026-09-28", start: "09:00", end: "17:00" },
    { id: "b-sep", employeeId: "employee-b", date: "2026-09-29", start: "10:00", end: "16:00" },
    { id: "a-oct", employeeId: "employee-a", date: "2026-10-01", start: "11:00", end: "15:00" },
    { id: "a-oct-next", employeeId: "employee-a", date: "2026-10-05", start: "12:00", end: "18:00" },
];

describe("Schedule PDF export model", () => {
    it("builds the complete selected-month team schedule with a predictable filename", () => {
        const model = buildScheduleExportDocument(
            SHIFTS, EMPLOYEES, DEFAULT_STORE_HOURS, 2026, 9,
            { scope: "team" },
        );

        expect(model).toMatchObject({
            productName: "PricePocket Crew",
            scope: "team",
            documentTitle: "Team Schedule",
            periodLabel: "September 2026",
            filename: "pp-crew-schedule-2026-09.pdf",
        });
        expect(model.weeks.flatMap(({ rows }) => rows.map(({ employeeName }) => employeeName)))
            .toEqual(["Avery North", "Blake West"]);
        expect(model.weeks.flatMap(({ rows }) => rows)
            .flatMap(({ cells }) => cells).flat()).toEqual([
                "09:00-17:00",
                "11:00-15:00",
                "10:00-16:00",
            ]);
        expect(JSON.stringify(model)).not.toContain("12:00-18:00");
    });

    it("uses configured operating days and keeps adjacent-month columns contextual", () => {
        const storeHours = cloneStoreHours(DEFAULT_STORE_HOURS);
        storeHours.days = storeHours.days.map((day) =>
            [1, 4].includes(day.dayOfWeek)
                ? day.isOpen ? day : {
                    dayOfWeek: day.dayOfWeek,
                    isOpen: true,
                    openTime: "09:00",
                    closeTime: "18:00",
                }
                : { dayOfWeek: day.dayOfWeek, isOpen: false },
        );

        const model = buildScheduleExportDocument(
            SHIFTS, EMPLOYEES, storeHours, 2026, 9,
            { scope: "team" },
        );

        expect(model.weeks[0]?.columns).toEqual([
            { date: "2026-09-28", label: "MON 28", inScheduleScope: true },
            { date: "2026-10-01", label: "THU 1", inScheduleScope: true },
        ]);
        expect(model.weeks.flatMap(({ rows }) => rows)
            .flatMap(({ cells }) => cells).flat()).toContain("11:00-15:00");
        expect(JSON.stringify(model)).not.toContain("12:00-18:00");
    });

    it("includes planned leading days from the opening boundary week", () => {
        const model = buildScheduleExportDocument(
            [
                { id: "sep-earlier", employeeId: "employee-a", date: "2026-09-21", start: "08:00", end: "14:00" },
                { id: "sep-boundary", employeeId: "employee-a", date: "2026-09-28", start: "09:00", end: "17:00" },
                { id: "oct-current", employeeId: "employee-a", date: "2026-10-01", start: "11:00", end: "15:00" },
            ],
            EMPLOYEES,
            DEFAULT_STORE_HOURS,
            2026,
            10,
            { scope: "team" },
        );

        expect(model.weeks[0]?.columns.find(({ date }) => date === "2026-09-28"))
            .toMatchObject({ inScheduleScope: true });
        expect(JSON.stringify(model)).toContain("09:00-17:00");
        expect(JSON.stringify(model)).toContain("11:00-15:00");
        expect(JSON.stringify(model)).not.toContain("08:00-14:00");
    });

    it("does not project employee contact information into the export document", () => {
        const model = buildScheduleExportDocument(
            SHIFTS, EMPLOYEES, DEFAULT_STORE_HOURS, 2026, 9,
            { scope: "team" },
        );

        expect(JSON.stringify(model)).not.toContain("@example.invalid");
    });

    it("formats zero-padded monthly filenames", () => {
        expect(scheduleExportFilename(2027, 2)).toBe("pp-crew-schedule-2027-02.pdf");
    });

    it("projects only the explicitly requested employee", () => {
        const model = buildScheduleExportDocument(
            SHIFTS, EMPLOYEES, DEFAULT_STORE_HOURS, 2026, 9,
            { scope: "employee", employeeId: "employee-a" },
        );

        expect(model).toMatchObject({
            scope: "employee",
            documentTitle: "Employee Schedule",
            employeeName: "Avery North",
            periodLabel: "September 2026",
            filename: "pp-crew-schedule-avery-north-2026-09.pdf",
        });
        expect(model.weeks.flatMap(({ rows }) => rows.map(({ employeeName }) => employeeName)))
            .toEqual(["Avery North"]);
        expect(JSON.stringify(model)).not.toContain("Blake West");
        expect(JSON.stringify(model)).not.toContain("10:00-16:00");
        expect(JSON.stringify(model)).not.toContain("12:00-18:00");
        expect(JSON.stringify(model)).not.toContain("@example.invalid");
    });

    it("keeps a known zero-shift employee export explicitly employee-scoped", () => {
        const model = buildScheduleExportDocument(
            SHIFTS, EMPLOYEES, DEFAULT_STORE_HOURS, 2026, 8,
            { scope: "employee", employeeId: "employee-a" },
        );

        expect(model).toMatchObject({
            scope: "employee",
            documentTitle: "Employee Schedule",
            employeeName: "Avery North",
            periodLabel: "August 2026",
            emptyMessage: "No shifts scheduled for this month.",
            weeks: [],
        });
        expect(JSON.stringify(model)).not.toContain("Blake West");
        expect(JSON.stringify(model)).not.toContain("10:00-16:00");
    });

    it("fails unknown employee exports instead of falling back to the team", () => {
        expect(() => buildScheduleExportDocument(
            SHIFTS, EMPLOYEES, DEFAULT_STORE_HOURS, 2026, 9,
            { scope: "employee", employeeId: "missing" },
        )).toThrow("Unknown employee: missing");
    });

    it("normalizes employee names for predictable filenames", () => {
        expect(employeeScheduleExportFilename("  Fïnn  Guy & Co.  ", 2026, 9))
            .toBe("pp-crew-schedule-finn-guy-co-2026-09.pdf");
    });

    it("keeps a complete week on the current page when it fits", () => {
        expect(decideWeekPagination(100, 194, 35, 80)).toBe("current-page");
    });

    it("moves a complete week to a fresh page when only the fresh page fits it", () => {
        expect(decideWeekPagination(150, 194, 35, 80)).toBe("next-page");
    });

    it("allows an oversized week to use the continuation path", () => {
        expect(decideWeekPagination(100, 194, 35, 170)).toBe("split");
    });
});
