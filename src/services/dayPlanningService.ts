import { legalAvailabilityHours } from "./availabilityService";
import { getDayOfWeek, timeToMinutes } from "./hoursService";
import { overlapsVacation } from "./vacationService";
import type { Employee, PlannerState, Shift } from "../types/planning";

export interface DayPlanningAvailability {
    employee: Employee;
    start: string;
    end: string;
    fullDay: boolean;
}

/** A read model for the Planner UI; Team availability remains authoritative. */
export function availableTeamForDay(state: PlannerState, date: string): DayPlanningAvailability[] {
    const day = getDayOfWeek(date);
    const opening = timeToMinutes(state.storeHours.open);
    const closing = timeToMinutes(state.storeHours.close);
    return state.employees.flatMap((employee) => {
        if (employee.status !== "active" || !employee.availability.days.includes(day) ||
            overlapsVacation(state.vacations, employee.id, date, date)) return [];
        const hours = legalAvailabilityHours(employee.availability);
        const start = Math.max(opening, hours.earliestStart ? timeToMinutes(hours.earliestStart) : opening);
        const end = Math.min(closing, hours.latestEnd ? timeToMinutes(hours.latestEnd) : closing);
        if (start >= end) return [];
        const toTime = (minutes: number): string =>
            `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
        return [{ employee, start: toTime(start), end: toTime(end), fullDay: start === opening && end === closing }];
    });
}

/** Assemble the one canonical shift list that is persisted after Save all. */
export function applyDayPlanningChanges(shifts: Shift[], upserts: Shift[], deletions: string[]): Shift[] {
    const changes = new Map(upserts.map((shift) => [shift.id, shift]));
    const removed = new Set(deletions);
    return [
        ...shifts.filter(({ id }) => !removed.has(id)).map((shift) => changes.get(shift.id) ?? shift),
        ...upserts.filter(({ id }) => !shifts.some((shift) => shift.id === id) && !removed.has(id)),
    ];
}
