import type { Employee } from "../types/planning";

export function employeeFullName(employee: Pick<Employee, "firstName" | "lastName">): string {
    return `${employee.firstName} ${employee.lastName}`.trim();
}

export function employeeSelectOptions(employees: Employee[]): Array<{ employee: Employee; label: string }> {
    const firstNameCounts = new Map<string, number>();
    for (const employee of employees) {
        const key = employee.firstName.trim().toLocaleLowerCase();
        firstNameCounts.set(key, (firstNameCounts.get(key) ?? 0) + 1);
    }

    return [...employees]
        .sort((a, b) =>
            a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" })
            || a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" })
            || a.id.localeCompare(b.id),
        )
        .map((employee) => ({
            employee,
            label: firstNameCounts.get(employee.firstName.trim().toLocaleLowerCase())! > 1
                ? employeeFullName(employee)
                : employee.firstName,
        }));
}
