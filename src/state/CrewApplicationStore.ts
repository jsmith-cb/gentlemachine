import type {
    CrewBusinessSettings,
    CrewRepository,
    CrewWorkspaceData,
} from "../repositories/CrewRepository";
import type { Employee, Shift, VacationPeriod } from "../types/planning";

export type CrewApplicationStoreState =
    | { readonly status: "idle" }
    | { readonly status: "loading" }
    | { readonly status: "ready"; readonly data: CrewWorkspaceData }
    | { readonly status: "error"; readonly error: Error };

type StoreListener = (state: CrewApplicationStoreState) => void;

export class CrewApplicationStore {
    private state: CrewApplicationStoreState = { status: "idle" };
    private readonly listeners = new Set<StoreListener>();
    private revision = 0;

    constructor(private readonly repository: CrewRepository) {}

    subscribe(listener: StoreListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    getState(): CrewApplicationStoreState {
        return this.state;
    }

    getReadyData(): CrewWorkspaceData {
        return cloneWorkspaceData(this.requireReady());
    }

    async load(): Promise<void> {
        const revision = ++this.revision;
        this.emit({ status: "loading" });
        try {
            const data = cloneWorkspaceData(await this.repository.loadWorkspace());
            if (revision !== this.revision) return;
            this.emit({ status: "ready", data });
        } catch (error) {
            if (revision !== this.revision) return;
            this.emit({ status: "error", error: toError(error) });
        }
    }

    invalidate(): void {
        this.revision += 1;
        this.emit({ status: "idle" });
    }

    async saveEmployee(employee: Employee): Promise<void> {
        await this.persist(async () => {
            await this.repository.saveEmployee(employee);
            return (data) => ({
                ...data,
                employees: upsertById(data.employees, structuredClone(employee)),
            });
        });
    }

    async saveVacation(vacation: VacationPeriod): Promise<void> {
        await this.persist(async () => {
            await this.repository.saveVacation(vacation);
            return (data) => ({
                ...data,
                vacations: upsertById(data.vacations, structuredClone(vacation)),
            });
        });
    }

    async refreshVacations(): Promise<void> {
        const current = this.requireReady();
        const revision = this.revision;
        const authoritative = await this.repository.loadWorkspace();
        if (revision !== this.revision || this.state.status !== "ready") return;
        const latest = this.state.data === current ? current : this.state.data;
        this.emit({ status: "ready", data: cloneWorkspaceData({
            ...latest,
            vacations: authoritative.vacations,
        }) });
    }

    async deleteVacation(vacationId: string): Promise<void> {
        await this.persist(async () => {
            await this.repository.deleteVacation(vacationId);
            return (data) => ({
                ...data,
                vacations: data.vacations.filter(({ id }) => id !== vacationId),
            });
        });
    }

    async replaceShifts(shifts: readonly Shift[]): Promise<void> {
        const replacement = shifts.map((shift) => ({ ...shift }));
        await this.persist(async () => {
            await this.repository.replaceShifts(replacement);
            return (data) => ({ ...data, shifts: replacement });
        });
    }

    async saveBusinessSettings(settings: CrewBusinessSettings): Promise<void> {
        const replacement = structuredClone(settings);
        await this.persist(async () => {
            await this.repository.saveBusinessSettings(replacement);
            return (data) => ({ ...data, settings: replacement });
        });
    }

    private async persist(
        operation: () => Promise<(data: CrewWorkspaceData) => CrewWorkspaceData>,
    ): Promise<void> {
        const current = this.requireReady();
        const revision = this.revision;
        const update = await operation();
        if (revision !== this.revision || this.state.status !== "ready") return;
        const latest = this.state.data === current ? current : this.state.data;
        this.emit({ status: "ready", data: cloneWorkspaceData(update(latest)) });
    }

    private requireReady(): CrewWorkspaceData {
        if (this.state.status !== "ready") {
            throw new Error("The canonical Crew workspace is not ready.");
        }
        return this.state.data;
    }

    private emit(state: CrewApplicationStoreState): void {
        this.state = state;
        for (const listener of this.listeners) listener(state);
    }
}

function upsertById<T extends { id: string }>(values: readonly T[], replacement: T): T[] {
    const found = values.some(({ id }) => id === replacement.id);
    return [
        ...values.map((value) => value.id === replacement.id ? replacement : value),
        ...(found ? [] : [replacement]),
    ];
}

function cloneWorkspaceData(data: CrewWorkspaceData): CrewWorkspaceData {
    return structuredClone(data);
}

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error("The canonical Crew workspace could not be loaded.");
}
