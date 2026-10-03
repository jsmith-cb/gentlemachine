export interface EmployeeScheduleShift {
    readonly id: string;
    readonly date: string;
    readonly start: string;
    readonly end: string;
}

export interface EmployeeScheduleDocument {
    readonly businessName: string;
    readonly employee: {
        readonly id: string;
        readonly firstName: string;
        readonly lastName: string;
    };
    readonly year: number;
    readonly month: number;
    readonly shifts: readonly EmployeeScheduleShift[];
}

export interface EmployeeScheduleRepository {
    getMySchedule(year: number, month: number): Promise<EmployeeScheduleDocument>;
}
