export type TimeOffRequestStatus = "pending" | "approved" | "declined" | "superseded";

export interface EmployeeTimeOffRequest {
    readonly id: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly status: TimeOffRequestStatus;
    readonly employeeNote?: string;
    readonly managerNote?: string;
    readonly createdAt: string;
    readonly supersededByRequestId?: string;
}

export interface ManagerTimeOffRequest extends EmployeeTimeOffRequest {
    readonly employeeId: string;
    readonly employeeName: string;
}

export interface TimeOffDecisionResult {
    readonly requestId: string;
    readonly status: "approved" | "declined";
    readonly vacationId?: string;
}

export interface EmployeeTimeOffRequestRepository {
    listMine(): Promise<readonly EmployeeTimeOffRequest[]>;
    submit(startDate: string, endDate: string, note?: string): Promise<void>;
}

export interface ManagerTimeOffRequestRepository {
    list(): Promise<readonly ManagerTimeOffRequest[]>;
    decide(requestId: string, decision: "approved" | "declined", note?: string): Promise<TimeOffDecisionResult>;
}
