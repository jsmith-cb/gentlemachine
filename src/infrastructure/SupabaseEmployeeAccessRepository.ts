import type { FunctionsHttpError, SupabaseClient } from "@supabase/supabase-js";
import type {
    EmployeeAccessRecord,
    EmployeeAccessRepository,
    EnableEmployeeAccessResult,
} from "../repositories/EmployeeAccessRepository";

interface AccessRow {
    employee_id: string;
    access_enabled: boolean;
    invited_at: string;
}

export class SupabaseEmployeeAccessRepository implements EmployeeAccessRepository {
    constructor(
        private readonly client: SupabaseClient,
        private readonly businessId: string,
    ) {}

    async list(): Promise<readonly EmployeeAccessRecord[]> {
        const { data, error } = await this.client.from("employee_access")
            .select("employee_id, access_enabled, invited_at")
            .eq("business_id", this.businessId);
        if (error) throw new Error(`Employee portal access could not be loaded: ${error.message}`);
        return (data as AccessRow[]).map((row) => ({
            employeeId: row.employee_id,
            accessEnabled: row.access_enabled,
            invitedAt: row.invited_at,
        }));
    }

    async enable(employeeId: string): Promise<EnableEmployeeAccessResult> {
        const { data, error } = await this.client.functions.invoke("enable-employee-access", {
            body: { employeeId },
        });
        if (error) throw new Error(await functionErrorMessage(error));
        if (!data || data.status !== "enabled" || typeof data.invitationSent !== "boolean") {
            throw new Error("Employee portal access returned an invalid response.");
        }
        return { invitationSent: data.invitationSent };
    }

    async disable(employeeId: string): Promise<void> {
        const { error } = await this.client.rpc("disable_employee_access", {
            target_employee_id: employeeId,
        });
        if (error) throw new Error(`Employee portal access could not be disabled: ${error.message}`);
    }
}

async function functionErrorMessage(error: FunctionsHttpError | Error): Promise<string> {
    if ("context" in error && error.context instanceof Response) {
        try {
            const body = await error.context.clone().json() as { error?: unknown };
            if (typeof body.error === "string" && body.error.trim()) return body.error;
        } catch {
            // Fall through to the SDK message.
        }
    }
    return error.message || "Employee portal access could not be enabled.";
}
