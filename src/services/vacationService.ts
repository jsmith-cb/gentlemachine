import type { VacationPeriod } from "../types/planning";

function isValidDateKey(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidVacationPeriod(value: unknown): value is VacationPeriod {
    if (!value || typeof value !== "object") return false;
    const period = value as Partial<VacationPeriod>;
    return typeof period.id === "string" && period.id.trim() !== ""
        && typeof period.employeeId === "string" && period.employeeId.trim() !== ""
        && typeof period.startDate === "string" && isValidDateKey(period.startDate)
        && typeof period.endDate === "string" && isValidDateKey(period.endDate)
        && period.startDate <= period.endDate;
}

export function vacationEmployeesOnDate(periods: VacationPeriod[], date: string): string[] {
    return [...new Set(periods
        .filter((period) => period.startDate <= date && date <= period.endDate)
        .map((period) => period.employeeId))];
}

export function overlapsVacation(
    periods: VacationPeriod[],
    employeeId: string,
    startDate: string,
    endDate: string,
): boolean {
    return periods.some((period) => period.employeeId === employeeId
        && startDate <= period.endDate && period.startDate <= endDate);
}
