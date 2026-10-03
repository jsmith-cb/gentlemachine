import type { SupabaseClient } from "@supabase/supabase-js";
import type {
    EmployeeTimeOffRequest, EmployeeTimeOffRequestRepository,
    ManagerTimeOffRequest, ManagerTimeOffRequestRepository, TimeOffDecisionResult,
    TimeOffRequestStatus,
} from "../repositories/TimeOffRequestRepository";

export class SupabaseEmployeeTimeOffRequestRepository implements EmployeeTimeOffRequestRepository {
    constructor(private readonly client: SupabaseClient) {}

    async listMine(): Promise<readonly EmployeeTimeOffRequest[]> {
        const { data, error } = await this.client.rpc("get_my_time_off_requests");
        if (error) throw new Error(error.message);
        if (!Array.isArray(data)) throw new Error("The time-off request response is invalid.");
        return data.map(mapEmployeeRequest);
    }

    async submit(startDate: string, endDate: string, note?: string): Promise<void> {
        const { error } = await this.client.rpc("submit_my_time_off_request", {
            requested_start_date: startDate,
            requested_end_date: endDate,
            requested_note: note?.trim() || null,
        });
        if (error) throw new Error(error.message);
    }
}

export class SupabaseManagerTimeOffRequestRepository implements ManagerTimeOffRequestRepository {
    constructor(private readonly client: SupabaseClient, private readonly businessId: string) {}

    async list(): Promise<readonly ManagerTimeOffRequest[]> {
        const { data, error } = await this.client.from("time_off_requests")
            .select("id, employee_id, start_date, end_date, status, employee_note, manager_note, created_at, superseded_by_request_id, employees!inner(first_name,last_name)")
            .eq("business_id", this.businessId).order("created_at", { ascending: false });
        if (error) throw new Error(`Time-off requests could not be loaded: ${error.message}`);
        return (data ?? []).map((value) => {
            const row = value as unknown as Record<string, unknown>;
            const employee = row.employees as Record<string, unknown>;
            const request = mapEmployeeRequest({
                id: row.id, startDate: row.start_date, endDate: row.end_date,
                status: row.status, employeeNote: row.employee_note,
                managerNote: row.manager_note, createdAt: row.created_at,
                supersededByRequestId: row.superseded_by_request_id,
            });
            if (typeof row.employee_id !== "string" || !employee ||
                typeof employee.first_name !== "string" || typeof employee.last_name !== "string") {
                throw new Error("A manager time-off request is invalid.");
            }
            return { ...request, employeeId: row.employee_id,
                employeeName: `${employee.first_name} ${employee.last_name}` };
        });
    }

    async decide(requestId: string, decision: "approved" | "declined", note?: string): Promise<TimeOffDecisionResult> {
        const { data, error } = await this.client.rpc("decide_time_off_request", {
            target_request_id: requestId, decision, decision_note: note?.trim() || null,
        });
        if (error) throw new Error(error.message);
        if (!isRecord(data) || typeof data.requestId !== "string" || data.status !== decision ||
            (data.vacationId !== null && data.vacationId !== undefined && typeof data.vacationId !== "string")) {
            throw new Error("The time-off decision response is invalid.");
        }
        return { requestId: data.requestId, status: decision,
            ...(typeof data.vacationId === "string" ? { vacationId: data.vacationId } : {}) };
    }
}

function mapEmployeeRequest(value: unknown): EmployeeTimeOffRequest {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.startDate !== "string" ||
        typeof value.endDate !== "string" || !isStatus(value.status) || typeof value.createdAt !== "string" ||
        (value.employeeNote != null && typeof value.employeeNote !== "string") ||
        (value.managerNote != null && typeof value.managerNote !== "string") ||
        (value.supersededByRequestId != null && typeof value.supersededByRequestId !== "string")) {
        throw new Error("A time-off request is invalid.");
    }
    return { id: value.id, startDate: value.startDate, endDate: value.endDate,
        status: value.status, createdAt: value.createdAt,
        ...(typeof value.employeeNote === "string" ? { employeeNote: value.employeeNote } : {}),
        ...(typeof value.managerNote === "string" ? { managerNote: value.managerNote } : {}),
        ...(typeof value.supersededByRequestId === "string"
            ? { supersededByRequestId: value.supersededByRequestId } : {}) };
}

function isStatus(value: unknown): value is TimeOffRequestStatus {
    return value === "pending" || value === "approved" || value === "declined" || value === "superseded";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
