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
    shiftFailure: Error | null = null;
    pendingLoad: Promise<CrewWorkspaceData> | null = null;
    savedEmployee: Employee | null = null;
    savedVacation: VacationPeriod | null = null;
    deletedVacationId: string | null = null;
    replacedShifts: readonly Shift[] | null = null;
    savedSettings: CrewBusinessSettings | null = null;

    async loadWorkspace(): Promise<CrewWorkspaceData> {
        return this.pendingLoad ?? structuredClone(this.workspace);
    }

    async saveEmployee(employee: Employee): Promise<void> {
        if (this.employeeFailure) throw this.employeeFailure;
        this.savedEmployee = structuredClone(employee);
    }

    async saveVacation(vacation: VacationPeriod): Promise<void> {
        this.savedVacation = structuredClone(vacation);
    }
    async deleteVacation(vacationId: string): Promise<void> {
        this.deletedVacationId = vacationId;
    }
    async replaceShifts(shifts: readonly Shift[]): Promise<void> {
        if (this.shiftFailure) throw this.shiftFailure;
        this.replacedShifts = structuredClone(shifts);
    }
    async saveBusinessSettings(settings: CrewBusinessSettings): Promise<void> {
        this.savedSettings = structuredClone(settings);
    }
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

    it("persists canonical domain mutations before updating application state", async () => {
        const repository = new FakeRepository();
        const store = new CrewApplicationStore(repository);
        await store.load();
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
        const vacation: VacationPeriod = {
            id: "20000000-0000-4000-8000-000000000001",
            employeeId: employee.id,
            startDate: "2026-10-12",
            endDate: "2026-10-16",
        };
        const shift: Shift = {
            id: "shift-1",
            employeeId: employee.id,
            date: "2026-10-19",
            start: "10:30",
            end: "16:30",
        };
        const settings: CrewBusinessSettings = {
            storeHours: DEFAULT_STORE_HOURS,
            softRules: { oneWeekendOffPerMonth: true },
        };

        await store.saveEmployee(employee);
        await store.saveVacation(vacation);
        await store.replaceShifts([shift]);
        await store.saveBusinessSettings(settings);

        expect(repository.savedEmployee).toEqual(employee);
        expect(repository.savedVacation).toEqual(vacation);
        expect(repository.replacedShifts).toEqual([shift]);
        expect(repository.savedSettings).toEqual(settings);
        expect(store.getReadyData()).toMatchObject({
            employees: [employee], vacations: [vacation], shifts: [shift], settings,
        });

        await store.deleteVacation(vacation.id);
        expect(repository.deletedVacationId).toBe(vacation.id);
        expect(store.getReadyData().vacations).toEqual([]);
    });

    it("does not accept proposed shift state when atomic persistence fails", async () => {
        const repository = new FakeRepository();
        repository.shiftFailure = new Error("atomic replacement failed");
        const store = new CrewApplicationStore(repository);
        await store.load();
        const before = store.getReadyData();

        await expect(store.replaceShifts([{
            id: "shift-1",
            employeeId: "10000000-0000-4000-8000-000000000001",
            date: "2026-10-19",
            start: "10:30",
            end: "16:30",
        }])).rejects.toThrow("atomic replacement failed");

        expect(store.getReadyData()).toEqual(before);
    });

    it("reconciles superseded vacations from canonical repository state", async () => {
        const repository = new FakeRepository();
        const oldVacation: VacationPeriod = {
            id: "20000000-0000-4000-8000-000000000001",
            employeeId: "10000000-0000-4000-8000-000000000001",
            startDate: "2026-10-05",
            endDate: "2026-10-05",
        };
        const replacement: VacationPeriod = {
            id: "20000000-0000-4000-8000-000000000002",
            employeeId: oldVacation.employeeId,
            startDate: "2026-10-02",
            endDate: "2026-10-07",
        };
        repository.workspace = { ...repository.workspace, vacations: [oldVacation] };
        const store = new CrewApplicationStore(repository);
        await store.load();
        repository.workspace = { ...repository.workspace, vacations: [replacement] };

        await store.refreshVacations();

        expect(store.getReadyData().vacations).toEqual([replacement]);
    });

    it("reconciles an ordinary approval from canonical repository state", async () => {
        const repository = new FakeRepository();
        const vacation: VacationPeriod = {
            id: "20000000-0000-4000-8000-000000000003",
            employeeId: "10000000-0000-4000-8000-000000000001",
            startDate: "2026-11-02",
            endDate: "2026-11-03",
        };
        const store = new CrewApplicationStore(repository);
        await store.load();
        repository.workspace = { ...repository.workspace, vacations: [vacation] };

        await store.refreshVacations();

        expect(store.getReadyData().vacations).toEqual([vacation]);
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
