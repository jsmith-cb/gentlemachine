import type { SupabaseClient } from "@supabase/supabase-js";
import type {
    CrewBusinessSettings,
    CrewRepository,
    CrewWorkspaceData,
} from "../repositories/CrewRepository";
import { CrewRepositoryError } from "../repositories/CrewRepository";
import { mapCanonicalWorkspaceRows } from "../repositories/crewRowMappers";
import {
    employeeToRow,
    settingsToRow,
    shiftToReplacementRow,
    vacationToRow,
} from "../repositories/crewRowWriters";
import type { Employee, Shift, VacationPeriod } from "../types/planning";

export class SupabaseCrewRepository implements CrewRepository {
    constructor(
        private readonly client: SupabaseClient,
        readonly businessId: string,
    ) {}

    async loadWorkspace(): Promise<CrewWorkspaceData> {
        try {
            const [business, employees, shifts, vacations, settings] = await Promise.all([
                this.client.from("businesses")
                    .select("id, name")
                    .eq("id", this.businessId)
                    .maybeSingle(),
                this.client.from("employees")
                    .select("id, business_id, employee_number, status, first_name, last_name, email, telephone_number, weekly_target_minutes, maximum_paid_minutes_per_day, max_days_per_week, availability")
                    .eq("business_id", this.businessId)
                    .order("created_at"),
                this.client.from("shifts")
                    .select("business_id, id, employee_id, shift_date, start_time, end_time")
                    .eq("business_id", this.businessId)
                    .order("shift_date")
                    .order("start_time")
                    .order("id"),
                this.client.from("vacations")
                    .select("id, business_id, employee_id, start_date, end_date")
                    .eq("business_id", this.businessId)
                    .order("start_date")
                    .order("id"),
                this.client.from("business_settings")
                    .select("business_id, store_hours, soft_rules")
                    .eq("business_id", this.businessId)
                    .maybeSingle(),
            ]);

            assertQuerySucceeded(business.error, "load the business workspace");
            assertQuerySucceeded(employees.error, "load employees");
            assertQuerySucceeded(shifts.error, "load shifts");
            assertQuerySucceeded(vacations.error, "load vacations");
            assertQuerySucceeded(settings.error, "load business settings");
            if (!business.data) throw new CrewRepositoryError("The authorized business workspace could not be loaded.");
            if (!settings.data) {
                throw new CrewRepositoryError("The canonical workspace is incomplete because Business Settings are missing.");
            }

            return mapCanonicalWorkspaceRows(this.businessId, {
                business: business.data,
                employees: employees.data,
                shifts: shifts.data,
                vacations: vacations.data,
                settings: settings.data,
            });
        } catch (error) {
            throw asRepositoryError("Could not load the canonical Crew workspace.", error);
        }
    }

    async saveEmployee(employee: Employee): Promise<void> {
        const row = employeeToRow(this.businessId, employee);
        try {
            const { error } = await this.client.from("employees")
                .upsert(row, { onConflict: "id" });
            assertQuerySucceeded(error, "save the employee");
        } catch (error) {
            throw asRepositoryError("The employee could not be saved.", error);
        }
    }

    async saveVacation(vacation: VacationPeriod): Promise<void> {
        const row = vacationToRow(this.businessId, vacation);
        try {
            const { error } = await this.client.from("vacations")
                .upsert(row, { onConflict: "id" });
            assertQuerySucceeded(error, "save the vacation");
        } catch (error) {
            throw asRepositoryError("The vacation could not be saved.", error);
        }
    }

    async deleteVacation(vacationId: string): Promise<void> {
        if (!vacationId.trim()) throw new CrewRepositoryError("Cannot delete a vacation without an identity.");
        try {
            const { error } = await this.client.from("vacations")
                .delete()
                .eq("business_id", this.businessId)
                .eq("id", vacationId);
            assertQuerySucceeded(error, "delete the vacation");
        } catch (error) {
            throw asRepositoryError("The vacation could not be deleted.", error);
        }
    }

    async replaceShifts(shifts: readonly Shift[]): Promise<void> {
        const replacementShifts = shifts.map(shiftToReplacementRow);
        try {
            const { error } = await this.client.rpc("replace_business_shifts", {
                target_business_id: this.businessId,
                replacement_shifts: replacementShifts,
            });
            assertQuerySucceeded(error, "replace shifts");
        } catch (error) {
            throw asRepositoryError("The schedule could not be saved.", error);
        }
    }

    async saveBusinessSettings(settings: CrewBusinessSettings): Promise<void> {
        const row = settingsToRow(this.businessId, settings);
        try {
            const { error } = await this.client.from("business_settings")
                .upsert(row, { onConflict: "business_id" });
            assertQuerySucceeded(error, "save business settings");
        } catch (error) {
            throw asRepositoryError("Business Settings could not be saved.", error);
        }
    }
}

function assertQuerySucceeded(error: { message: string } | null, operation: string): void {
    if (error) throw new CrewRepositoryError(`Supabase could not ${operation}: ${error.message}`);
}

function asRepositoryError(message: string, error: unknown): CrewRepositoryError {
    return error instanceof CrewRepositoryError
        ? error
        : new CrewRepositoryError(message, { cause: error });
}
