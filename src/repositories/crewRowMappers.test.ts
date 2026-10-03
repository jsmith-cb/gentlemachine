import { describe, expect, it } from "vitest";
import { DEFAULT_SOFT_RULE_SETTINGS } from "../services/softRulesService";
import { DEFAULT_STORE_HOURS } from "../services/storeHoursService";
import { mapCanonicalWorkspaceRows } from "./crewRowMappers";

const BUSINESS_ID = "20000000-0000-4000-8000-000000000001";
const EMPLOYEE_ID = "30000000-0000-4000-8000-000000000001";

function canonicalRows() {
    return {
        business: { id: BUSINESS_ID, name: "Test Crew" },
        employees: [{
            id: EMPLOYEE_ID,
            business_id: BUSINESS_ID,
            employee_number: "AJ-1",
            status: "active",
            first_name: "AJ",
            last_name: "Smith",
            email: "aj@example.invalid",
            telephone_number: null,
            weekly_target_minutes: 2400,
            maximum_paid_minutes_per_day: 420,
            max_days_per_week: 5,
            availability: { days: [1, 2, 3, 4, 5], earliestStart: "09:00", latestEnd: "18:00" },
        }],
        shifts: [{
            business_id: BUSINESS_ID,
            id: "shift-1",
            employee_id: EMPLOYEE_ID,
            shift_date: "2026-10-05",
            start_time: "09:00:00",
            end_time: "17:00:00",
        }],
        vacations: [{
            id: "40000000-0000-4000-8000-000000000001",
            business_id: BUSINESS_ID,
            employee_id: EMPLOYEE_ID,
            start_date: "2026-10-12",
            end_date: "2026-10-16",
        }],
        settings: {
            business_id: BUSINESS_ID,
            store_hours: DEFAULT_STORE_HOURS,
            soft_rules: DEFAULT_SOFT_RULE_SETTINGS,
        },
    };
}

describe("canonical Crew row mapping", () => {
    it("maps canonical rows into domain structures", () => {
        expect(mapCanonicalWorkspaceRows(BUSINESS_ID, canonicalRows())).toMatchObject({
            workspace: { id: BUSINESS_ID, name: "Test Crew" },
            employees: [{
                id: EMPLOYEE_ID,
                firstName: "AJ",
                lastName: "Smith",
                maximumPaidMinutesPerDay: 420,
            }],
            shifts: [{
                id: "shift-1",
                employeeId: EMPLOYEE_ID,
                date: "2026-10-05",
                start: "09:00",
                end: "17:00",
            }],
            vacations: [{ employeeId: EMPLOYEE_ID }],
            settings: {
                storeHours: DEFAULT_STORE_HOURS,
                softRules: DEFAULT_SOFT_RULE_SETTINGS,
            },
        });
    });

    it("rejects malformed canonical data explicitly", () => {
        const rows = canonicalRows();
        rows.employees[0].availability = { days: [8], earliestStart: "09:00", latestEnd: "18:00" };

        expect(() => mapCanonicalWorkspaceRows(BUSINESS_ID, rows))
            .toThrow("Canonical Crew data is invalid: employees[0].availability.days is invalid");
    });

    it("rejects rows outside the authorized business", () => {
        const rows = canonicalRows();
        rows.shifts[0].business_id = "20000000-0000-4000-8000-000000000002";

        expect(() => mapCanonicalWorkspaceRows(BUSINESS_ID, rows))
            .toThrow("shifts[0] is outside the authorized workspace");
    });
});
