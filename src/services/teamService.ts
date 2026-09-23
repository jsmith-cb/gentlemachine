import type { Employee, Shift } from "../types/planning";

export function activeEmployees(employees: Employee[]): Employee[] {
    return employees.filter((employee) => employee.status === "active");
}

export function createTeamMemberDraft(): Employee {
    return {
        id: `employee-${crypto.randomUUID()}`,
        employeeNumber: "",
        status: "active",
        firstName: "",
        lastName: "",
        weeklyTargetMinutes: 0,
        maxDaysPerWeek: 5,
        availability: { days: [] },
    };
}

export function deactivateTeamMember(employees: Employee[], id: string): Employee[] {
    return employees.map((employee) => employee.id === id
        ? { ...employee, status: "inactive" }
        : employee);
}

export function employeesForPlanningPeriod(
    employees: Employee[], shifts: Shift[], startDate: string, endDate: string,
): Employee[] {
    const referencedIds = new Set(shifts
        .filter((shift) => startDate <= shift.date && shift.date <= endDate)
        .map((shift) => shift.employeeId));
    return employees.filter((employee) => employee.status === "active" || referencedIds.has(employee.id));
}
