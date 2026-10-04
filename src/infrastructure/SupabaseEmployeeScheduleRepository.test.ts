import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseEmployeeScheduleRepository } from "./SupabaseEmployeeScheduleRepository";

describe("SupabaseEmployeeScheduleRepository", () => {
    it("calls get_my_schedule with a period and no client-selected Employee identity", async () => {
        const calls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
        const client = {
            async rpc(name: string, parameters: Record<string, unknown>) {
                calls.push({ name, parameters });
                return {
                    error: null,
                    data: {
                        businessName: "Test Crew",
                        employee: { id: "employee-1", firstName: "Alex", lastName: "Example" },
                        year: 2026,
                        month: 10,
                        shifts: [],
                    },
                };
            },
        } as unknown as SupabaseClient;

        await new SupabaseEmployeeScheduleRepository(client).getMySchedule(2026, 10);

        expect(calls).toEqual([{
            name: "get_my_schedule",
            parameters: { schedule_year: 2026, schedule_month: 10 },
        }]);
    });

    it("rejects an over-broad or malformed employee projection", async () => {
        const client = {
            async rpc() {
                return { error: null, data: { employee: { id: "employee-1" }, shifts: [] } };
            },
        } as unknown as SupabaseClient;

        await expect(new SupabaseEmployeeScheduleRepository(client).getMySchedule(2026, 10))
            .rejects.toThrow("employee schedule response is invalid");
    });
});
