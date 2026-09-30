import { describe, expect, it } from "vitest";

import {
    buildScheduleExportDocument,
    decideWeekPagination,
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
];

describe("Schedule PDF export model", () => {
    it("builds the complete selected-month team schedule with a predictable filename", () => {
        const model = buildScheduleExportDocument(
            SHIFTS, EMPLOYEES, DEFAULT_STORE_HOURS, 2026, 9,
        );

        expect(model).toMatchObject({
            productName: "PricePocket Crew",
            periodLabel: "September 2026",
            filename: "pp-crew-schedule-2026-09.pdf",
        });
        expect(model.weeks.flatMap(({ rows }) => rows.map(({ employeeName }) => employeeName)))
            .toEqual(["Avery North", "Blake West"]);
        expect(model.weeks.flatMap(({ rows }) => rows)
            .flatMap(({ cells }) => cells).flat()).toEqual(["09:00-17:00", "10:00-16:00"]);
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
        );

        expect(model.weeks[0]?.columns).toEqual([
            { date: "2026-09-28", label: "MON 28", inSelectedMonth: true },
            { date: "2026-10-01", label: "THU 1", inSelectedMonth: false },
        ]);
        expect(model.weeks.flatMap(({ rows }) => rows)
            .flatMap(({ cells }) => cells).flat()).not.toContain("11:00-15:00");
    });

    it("does not project employee contact information into the export document", () => {
        const model = buildScheduleExportDocument(
            SHIFTS, EMPLOYEES, DEFAULT_STORE_HOURS, 2026, 9,
        );

        expect(JSON.stringify(model)).not.toContain("@example.invalid");
    });

    it("formats zero-padded monthly filenames", () => {
        expect(scheduleExportFilename(2027, 2)).toBe("pp-crew-schedule-2027-02.pdf");
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
