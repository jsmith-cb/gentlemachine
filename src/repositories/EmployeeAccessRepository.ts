export interface EmployeeAccessRecord {
    readonly employeeId: string;
    readonly accessEnabled: boolean;
    readonly invitedAt: string;
}

export interface EnableEmployeeAccessResult {
    readonly invitationSent: boolean;
}

export interface EmployeeAccessRepository {
    list(): Promise<readonly EmployeeAccessRecord[]>;
    enable(employeeId: string): Promise<EnableEmployeeAccessResult>;
    disable(employeeId: string): Promise<void>;
}
