import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SCHEDULING_RULE_SETTINGS } from "../services/schedulingRulesService";
import { DEFAULT_STORE_HOURS } from "../services/storeHoursService";
import { SupabaseCrewRepository } from "./SupabaseCrewRepository";

const BUSINESS_ID = "20000000-0000-4000-8000-000000000001";

interface QueryResult { data: unknown; error: null }

class FakeQuery implements PromiseLike<QueryResult> {
    readonly equalityFilters: Array<[string, unknown]> = [];

    constructor(private readonly result: QueryResult) {}
    select(): this { return this; }
    eq(column: string, value: unknown): this {
        this.equalityFilters.push([column, value]);
        return this;
    }
    order(): this { return this; }
    maybeSingle(): Promise<QueryResult> { return Promise.resolve(this.result); }
    then<TResult1 = QueryResult, TResult2 = never>(
        onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(this.result).then(onfulfilled, onrejected);
    }
}

function createLoadClient(settings: unknown = {
    business_id: BUSINESS_ID,
    store_hours: DEFAULT_STORE_HOURS,
    scheduling_rules: DEFAULT_SCHEDULING_RULE_SETTINGS,
}) {
    const queries = new Map<string, FakeQuery>();
    const values: Record<string, unknown> = {
        businesses: { id: BUSINESS_ID, name: "Test Crew" },
        employees: [],
        shifts: [],
        vacations: [],
        sick_reports: [],
        business_settings: settings,
    };
    const client = {
        from(table: string) {
            const query = new FakeQuery({ data: values[table], error: null });
            queries.set(table, query);
            return query;
        },
    } as unknown as SupabaseClient;
    return { client, queries };
}

describe("SupabaseCrewRepository", () => {
    it("loads an authorized workspace with every query fixed to its business", async () => {
        const { client, queries } = createLoadClient();
        const repository = new SupabaseCrewRepository(client, BUSINESS_ID);

        await expect(repository.loadWorkspace()).resolves.toMatchObject({
            workspace: { id: BUSINESS_ID, name: "Test Crew" },
        });
        expect([...queries.values()]).toHaveLength(6);
        for (const query of queries.values()) {
            expect(query.equalityFilters).toContainEqual([
                query === queries.get("businesses") ? "id" : "business_id",
                BUSINESS_ID,
            ]);
        }
    });

    it("fails hydration when canonical Business Settings are missing", async () => {
        const { client } = createLoadClient(null);
        const repository = new SupabaseCrewRepository(client, BUSINESS_ID);

        await expect(repository.loadWorkspace()).rejects.toThrow(
            "The canonical workspace is incomplete because Business Settings are missing.",
        );
    });
});
