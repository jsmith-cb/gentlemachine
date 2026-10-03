import { describe, expect, it } from "vitest";
import type {
    CrewBusinessSettings,
    CrewRepository,
    CrewWorkspaceData,
} from "../repositories/CrewRepository";
import type { Employee, Shift, VacationPeriod } from "../types/planning";
import { DEFAULT_SOFT_RULE_SETTINGS } from "../services/softRulesService";
import { DEFAULT_STORE_HOURS } from "../services/storeHoursService";
import { CrewApplicationStore } from "./CrewApplicationStore";

const WORKSPACE: CrewWorkspaceData = {
    workspace: { id: "business-1", name: "Test Business" },
    employees: [],
    shifts: [],
    vacations: [],
    settings: {
        storeHours: DEFAULT_STORE_HOURS,
        softRules: DEFAULT_SOFT_RULE_SETTINGS,
    },
};

class FakeRepository implements CrewRepository {
    readonly businessId = "business-1";
    workspace = structuredClone(WORKSPACE);
    employeeFailure: Error | null = null;
    pendingLoad: Promise<CrewWorkspaceData> | null = null;

    async loadWorkspace(): Promise<CrewWorkspaceData> {
        return this.pendingLoad ?? structuredClone(this.workspace);
    }

    async saveEmployee(): Promise<void> {
        if (this.employeeFailure) throw this.employeeFailure;
    }

    async saveVacation(_vacation: VacationPeriod): Promise<void> {}
    async deleteVacation(_vacationId: string): Promise<void> {}
    async replaceShifts(_shifts: readonly Shift[]): Promise<void> {}
    async saveBusinessSettings(_settings: CrewBusinessSettings): Promise<void> {}
}

describe("CrewApplicationStore", () => {
    it("loads validated canonical workspace state", async () => {
        const store = new CrewApplicationStore(new FakeRepository());
        await store.load();

        expect(store.getState()).toEqual({ status: "ready", data: WORKSPACE });
    });

    it("does not present a failed write as successful state", async () => {
        const repository = new FakeRepository();
        repository.employeeFailure = new Error("write failed");
        const store = new CrewApplicationStore(repository);
        await store.load();
        const before = structuredClone(store.getState());
        const employee: Employee = {
            id: "10000000-0000-4000-8000-000000000001",
            employeeNumber: "A-1",
            status: "active",
            firstName: "Alex",
            lastName: "Example",
            weeklyTargetMinutes: 1200,
            maxDaysPerWeek: 5,
            availability: { days: [1, 2, 3, 4, 5] },
        };

        await expect(store.saveEmployee(employee)).rejects.toThrow("write failed");
        expect(store.getState()).toEqual(before);
    });

    it("ignores a late load after the authenticated workspace is invalidated", async () => {
        const repository = new FakeRepository();
        let resolveLoad: ((value: CrewWorkspaceData) => void) | undefined;
        repository.pendingLoad = new Promise((resolve) => {
            resolveLoad = resolve;
        });
        const store = new CrewApplicationStore(repository);

        const loading = store.load();
        store.invalidate();
        resolveLoad?.(structuredClone(WORKSPACE));
        await loading;

        expect(store.getState()).toEqual({ status: "idle" });
    });
});
