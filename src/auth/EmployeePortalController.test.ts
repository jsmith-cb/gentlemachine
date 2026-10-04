import { describe, expect, it } from "vitest";
import type {
    AuthenticatedUser,
    AuthenticationSessionGateway,
} from "./ManagerAuthController";
import type {
    EmployeeScheduleDocument,
    EmployeeScheduleRepository,
} from "../repositories/EmployeeScheduleRepository";
import { EmployeePortalController, type EmployeePortalState } from "./EmployeePortalController";
import type { EmployeeTimeOffRequest, EmployeeTimeOffRequestRepository } from "../repositories/TimeOffRequestRepository";
import type { EmployeeSickReportRepository } from "../repositories/SickReportRepository";

const USER: AuthenticatedUser = { id: "auth-employee", email: "employee@example.invalid" };
const SCHEDULE: EmployeeScheduleDocument = {
    businessName: "Test Crew",
    employee: { id: "employee-1", firstName: "Alex", lastName: "Example" },
    year: 2026,
    month: 10,
    shifts: [{ id: "shift-1", date: "2026-10-05", start: "10:30", end: "16:30" }],
};

class FakeSession implements AuthenticationSessionGateway {
    user: AuthenticatedUser | null = null;
    requested: { email: string; redirectUrl: string } | null = null;
    listener: ((user: AuthenticatedUser | null) => void) | null = null;
    async getSessionUser() { return this.user; }
    onSessionChange(listener: (user: AuthenticatedUser | null) => void) {
        this.listener = listener;
        return () => { this.listener = null; };
    }
    async requestMagicLink(email: string, redirectUrl: string) {
        this.requested = { email, redirectUrl };
    }
    async signOut() { this.user = null; }
}

class FakeSchedules implements EmployeeScheduleRepository {
    failure: Error | null = null;
    requests: Array<[number, number]> = [];
    async getMySchedule(year: number, month: number): Promise<EmployeeScheduleDocument> {
        this.requests.push([year, month]);
        if (this.failure) throw this.failure;
        return { ...SCHEDULE, year, month };
    }
}

class FakeRequests implements EmployeeTimeOffRequestRepository {
    requests: EmployeeTimeOffRequest[] = [];
    submitted: { startDate: string; endDate: string; note?: string } | null = null;
    async listMine() { return this.requests; }
    async submit(startDate: string, endDate: string, note?: string) {
        this.submitted = { startDate, endDate, note };
        this.requests = [{ id: "request-1", startDate, endDate, status: "pending",
            ...(note ? { employeeNote: note } : {}), createdAt: "2026-10-04T10:00:00Z" }];
    }
}
class FakeSickReports implements EmployeeSickReportRepository { async listMine(){return [];} async report(){return undefined;} }

function observe(controller: EmployeePortalController): EmployeePortalState[] {
    const states: EmployeePortalState[] = [];
    controller.subscribe((state) => states.push(state));
    return states;
}

describe("EmployeePortalController", () => {
    it("loads the authenticated employee own schedule without accepting an Employee ID", async () => {
        const session = new FakeSession();
        session.user = USER;
        const schedules = new FakeSchedules();
        const controller = new EmployeePortalController(session, schedules, new FakeRequests(), new FakeSickReports(), "http://localhost/my-schedule");
        const states = observe(controller);

        await controller.initialize();

        expect(states.at(-1)).toMatchObject({
            status: "authenticated",
            user: USER,
            schedule: { employee: { id: "employee-1" } },
        });
        expect(schedules.requests).toHaveLength(1);
    });

    it("shows an explicit unavailable state when the Auth identity has no active access", async () => {
        const session = new FakeSession();
        session.user = USER;
        const schedules = new FakeSchedules();
        schedules.failure = new Error("Employee schedule access is unavailable.");
        const controller = new EmployeePortalController(session, schedules, new FakeRequests(), new FakeSickReports(), "http://localhost/my-schedule");
        const states = observe(controller);

        await controller.initialize();

        expect(states.at(-1)).toEqual({ status: "unavailable", email: USER.email });
    });

    it("does not misrepresent a schedule loading failure as unavailable access", async () => {
        const session = new FakeSession();
        session.user = USER;
        const schedules = new FakeSchedules();
        schedules.failure = new Error("The schedule service could not be reached.");
        const controller = new EmployeePortalController(session, schedules, new FakeRequests(), new FakeSickReports(), "http://localhost/my-schedule");
        const states = observe(controller);

        await controller.initialize();

        expect(states.at(-1)).toEqual({
            status: "error",
            message: "The schedule service could not be reached.",
        });
    });

    it("uses passwordless sign-in with the employee portal callback", async () => {
        const session = new FakeSession();
        const controller = new EmployeePortalController(
            session, new FakeSchedules(), new FakeRequests(), new FakeSickReports(), "http://localhost/my-schedule",
        );
        const states = observe(controller);

        await controller.requestMagicLink(" employee@example.invalid ");

        expect(session.requested).toEqual({
            email: "employee@example.invalid",
            redirectUrl: "http://localhost/my-schedule",
        });
        expect(states.at(-1)).toEqual({ status: "email-sent", email: "employee@example.invalid" });
    });

    it("loads another month through the same authenticated employee boundary", async () => {
        const session = new FakeSession();
        session.user = USER;
        const schedules = new FakeSchedules();
        const controller = new EmployeePortalController(session, schedules, new FakeRequests(), new FakeSickReports(), "http://localhost/my-schedule");
        const states = observe(controller);
        await controller.initialize();

        await controller.loadMonth(2026, 11);

        expect(schedules.requests.at(-1)).toEqual([2026, 11]);
        expect(states.at(-1)).toMatchObject({ status: "authenticated", schedule: { year: 2026, month: 11 } });
    });

    it("shows unavailable when employee access is revoked before loading another month", async () => {
        const session = new FakeSession();
        session.user = USER;
        const schedules = new FakeSchedules();
        const controller = new EmployeePortalController(session, schedules, new FakeRequests(), new FakeSickReports(), "http://localhost/my-schedule");
        const states = observe(controller);
        await controller.initialize();
        schedules.failure = new Error("Employee schedule access is unavailable.");

        await controller.loadMonth(2026, 11);

        expect(states.at(-1)).toEqual({ status: "unavailable", email: USER.email });
    });

    it("persists and then displays an employee time-off request", async () => {
        const session = new FakeSession();
        session.user = USER;
        const requests = new FakeRequests();
        const controller = new EmployeePortalController(
            session, new FakeSchedules(), requests, new FakeSickReports(), "http://localhost/my-schedule",
        );
        const states = observe(controller);
        await controller.initialize();

        await controller.submitTimeOff("2026-11-02", "2026-11-03", "Family event");

        expect(requests.submitted).toEqual({
            startDate: "2026-11-02", endDate: "2026-11-03", note: "Family event",
        });
        expect(states.at(-1)).toMatchObject({
            status: "authenticated",
            requests: [{ id: "request-1", status: "pending" }],
            requestMessage: "Time-off request submitted.",
        });
    });
});
