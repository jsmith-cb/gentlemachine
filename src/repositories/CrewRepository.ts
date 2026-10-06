import type {
    Employee,
    Shift,
    SchedulingRuleSettings,
    StoreHours,
    SicknessPeriod,
    VacationPeriod,
} from "../types/planning";

export interface CrewWorkspaceIdentity {
    readonly id: string;
    readonly name: string;
}

export interface CrewBusinessSettings {
    readonly storeHours: StoreHours;
    readonly schedulingRules: SchedulingRuleSettings;
}

export interface CrewWorkspaceData {
    readonly workspace: CrewWorkspaceIdentity;
    readonly employees: readonly Employee[];
    readonly shifts: readonly Shift[];
    readonly vacations: readonly VacationPeriod[];
    readonly sicknesses: readonly SicknessPeriod[];
    readonly settings: CrewBusinessSettings;
}

export interface CrewRepository {
    readonly businessId: string;

    loadWorkspace(): Promise<CrewWorkspaceData>;
    saveEmployee(employee: Employee): Promise<void>;
    saveVacation(vacation: VacationPeriod): Promise<void>;
    deleteVacation(vacationId: string): Promise<void>;
    replaceShifts(shifts: readonly Shift[]): Promise<void>;
    saveBusinessSettings(settings: CrewBusinessSettings): Promise<void>;
}

export class CrewRepositoryError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "CrewRepositoryError";
    }
}
