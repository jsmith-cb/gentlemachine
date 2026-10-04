import type { SicknessPeriod } from "../types/planning";
export function overlapsSickness(periods: readonly SicknessPeriod[], employeeId: string, startDate: string, endDate: string): boolean {
    return periods.some((period) => period.employeeId === employeeId && startDate <= period.endDate && period.startDate <= endDate);
}
