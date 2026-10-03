import type { SupabaseClient } from "@supabase/supabase-js";
import type {
    EmployeeScheduleDocument,
    EmployeeScheduleRepository,
} from "../repositories/EmployeeScheduleRepository";

export class SupabaseEmployeeScheduleRepository implements EmployeeScheduleRepository {
    constructor(private readonly client: SupabaseClient) {}

    async getMySchedule(year: number, month: number): Promise<EmployeeScheduleDocument> {
        const { data, error } = await this.client.rpc("get_my_schedule", {
            schedule_year: year,
            schedule_month: month,
        });
        if (error) throw new Error(error.message);
        return validateSchedule(data);
    }
}

function validateSchedule(value: unknown): EmployeeScheduleDocument {
    if (!isRecord(value) || typeof value.businessName !== "string" ||
        !Number.isInteger(value.year) || !Number.isInteger(value.month) ||
        !isRecord(value.employee) || typeof value.employee.id !== "string" ||
        typeof value.employee.firstName !== "string" || typeof value.employee.lastName !== "string" ||
        !Array.isArray(value.shifts)) {
        throw new Error("The employee schedule response is invalid.");
    }
    const shifts = value.shifts.map((shift) => {
        if (!isRecord(shift) || typeof shift.id !== "string" ||
            typeof shift.date !== "string" || typeof shift.start !== "string" ||
            typeof shift.end !== "string") {
            throw new Error("The employee schedule contains an invalid shift.");
        }
        return { id: shift.id, date: shift.date, start: shift.start, end: shift.end };
    });
    return {
        businessName: value.businessName,
        employee: {
            id: value.employee.id,
            firstName: value.employee.firstName,
            lastName: value.employee.lastName,
        },
        year: value.year,
        month: value.month,
        shifts,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
