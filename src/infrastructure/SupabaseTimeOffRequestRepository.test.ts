import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseEmployeeTimeOffRequestRepository } from "./SupabaseTimeOffRequestRepository";

describe("SupabaseEmployeeTimeOffRequestRepository", () => {
    it("submits employee-controlled dates and note without an Employee identity", async () => {
        const calls: Array<{ name: string; parameters?: Record<string, unknown> }> = [];
        const client = { async rpc(name: string, parameters?: Record<string, unknown>) {
            calls.push({ name, parameters }); return { data: "request-1", error: null };
        } } as unknown as SupabaseClient;

        await new SupabaseEmployeeTimeOffRequestRepository(client)
            .submit("2026-11-02", "2026-11-03", "Family event");

        expect(calls).toEqual([{ name: "submit_my_time_off_request", parameters: {
            requested_start_date: "2026-11-02", requested_end_date: "2026-11-03",
            requested_note: "Family event",
        } }]);
    });

    it("loads only the authenticated employee projection", async () => {
        const client = { async rpc(name: string, parameters?: Record<string, unknown>) {
            expect(name).toBe("get_my_time_off_requests");
            expect(parameters).toBeUndefined();
            return { error: null, data: [{ id: "request-1", startDate: "2026-11-02",
                endDate: "2026-11-03", status: "pending", employeeNote: null,
                managerNote: null, createdAt: "2026-10-04T10:00:00Z" }] };
        } } as unknown as SupabaseClient;

        await expect(new SupabaseEmployeeTimeOffRequestRepository(client).listMine())
            .resolves.toMatchObject([{ id: "request-1", status: "pending" }]);
    });
});
