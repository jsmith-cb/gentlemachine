import { describe, expect, it } from "vitest";
import { isValidVacationPeriod, overlapsVacation, vacationEmployeesOnDate } from "./vacationService";
import type { VacationPeriod } from "../types/planning";

const vacation: VacationPeriod = {
    id: "vacation-1",
    employeeId: "employee-1",
    startDate: "2026-09-29",
    endDate: "2026-10-02",
};

describe("vacation planning", () => {
    it("validates real inclusive date ranges", () => {
        expect(isValidVacationPeriod(vacation)).toBe(true);
        expect(isValidVacationPeriod({ ...vacation, endDate: "2026-09-28" })).toBe(false);
        expect(isValidVacationPeriod({ ...vacation, startDate: "2026-09-31" })).toBe(false);
    });

    it("places a vacation on each date, including across month boundaries", () => {
        expect(vacationEmployeesOnDate([vacation], "2026-09-28")).toEqual([]);
        expect(vacationEmployeesOnDate([vacation], "2026-09-29")).toEqual(["employee-1"]);
        expect(vacationEmployeesOnDate([vacation], "2026-10-02")).toEqual(["employee-1"]);
        expect(vacationEmployeesOnDate([vacation], "2026-10-03")).toEqual([]);
    });

    it("detects overlap only for the same employee", () => {
        expect(overlapsVacation([vacation], "employee-1", "2026-10-02", "2026-10-04")).toBe(true);
        expect(overlapsVacation([vacation], "employee-2", "2026-10-02", "2026-10-04")).toBe(false);
    });
});
