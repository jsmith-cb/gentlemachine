import { describe, expect, it, vi } from "vitest";
import {
    ManagerAuthController,
    type AuthenticatedUser,
    type ManagerAuthGateway,
    type ManagerAuthState,
    type ManagerMembership,
} from "./ManagerAuthController";

class FakeAuthGateway implements ManagerAuthGateway {
    sessionUser: AuthenticatedUser | null = null;
    memberships: ManagerMembership[] = [];
    requestedLink: { email: string; redirectUrl: string } | null = null;
    signOutCalls = 0;
    private sessionListener: ((user: AuthenticatedUser | null) => void) | null = null;

    async getSessionUser(): Promise<AuthenticatedUser | null> {
        return this.sessionUser;
    }

    onSessionChange(listener: (user: AuthenticatedUser | null) => void): () => void {
        this.sessionListener = listener;
        return () => {
            this.sessionListener = null;
        };
    }

    async requestMagicLink(email: string, redirectUrl: string): Promise<void> {
        this.requestedLink = { email, redirectUrl };
    }

    async findManagerMembership(): Promise<readonly ManagerMembership[]> {
        return this.memberships;
    }

    async signOut(): Promise<void> {
        this.signOutCalls += 1;
        this.sessionUser = null;
    }

    emitSession(user: AuthenticatedUser | null): void {
        this.sessionListener?.(user);
    }
}

function observe(controller: ManagerAuthController): ManagerAuthState[] {
    const states: ManagerAuthState[] = [];
    controller.subscribe((state) => states.push(state));
    return states;
}

describe("ManagerAuthController", () => {
    it("initializes to signed out without a session", async () => {
        const controller = new ManagerAuthController(new FakeAuthGateway(), "http://localhost/");
        const states = observe(controller);

        await controller.initialize();

        expect(states.at(-1)).toEqual({ status: "signed-out" });
    });

    it("surfaces a failed authentication callback when no session was established", async () => {
        const controller = new ManagerAuthController(new FakeAuthGateway(), "http://localhost/");
        const states = observe(controller);

        await controller.initialize("The sign-in link is invalid or has expired.");

        expect(states.at(-1)).toEqual({
            status: "error",
            message: "The sign-in link is invalid or has expired.",
        });
    });

    it("requests a magic link without permitting self-service signup", async () => {
        const gateway = new FakeAuthGateway();
        const controller = new ManagerAuthController(gateway, "http://localhost/pricepocket_crew/");
        const states = observe(controller);

        await controller.requestMagicLink(" manager@example.com ");

        expect(gateway.requestedLink).toEqual({
            email: "manager@example.com",
            redirectUrl: "http://localhost/pricepocket_crew/",
        });
        expect(states.at(-1)).toEqual({
            status: "email-sent",
            email: "manager@example.com",
        });
    });

    it("resolves one manager membership into an authenticated workspace", async () => {
        const gateway = new FakeAuthGateway();
        gateway.sessionUser = { id: "user-1", email: "manager@example.com" };
        gateway.memberships = [{
            businessId: "business-1",
            businessName: "Test Business",
            role: "manager",
        }];
        const controller = new ManagerAuthController(gateway, "http://localhost/");
        const states = observe(controller);

        await controller.initialize();

        expect(states.at(-1)).toEqual({
            status: "authenticated",
            manager: {
                userId: "user-1",
                email: "manager@example.com",
                businessId: "business-1",
                businessName: "Test Business",
                role: "manager",
            },
        });
    });

    it("does not open the application when the manager has no membership", async () => {
        const gateway = new FakeAuthGateway();
        gateway.sessionUser = { id: "user-1", email: "manager@example.com" };
        const controller = new ManagerAuthController(gateway, "http://localhost/");
        const states = observe(controller);

        await controller.initialize();

        expect(states.at(-1)).toEqual({
            status: "missing-membership",
            email: "manager@example.com",
        });
    });

    it("rejects ambiguous workspace membership until switching is supported", async () => {
        const gateway = new FakeAuthGateway();
        gateway.sessionUser = { id: "user-1", email: "manager@example.com" };
        gateway.memberships = [
            { businessId: "business-1", businessName: "One", role: "manager" },
            { businessId: "business-2", businessName: "Two", role: "manager" },
        ];
        const controller = new ManagerAuthController(gateway, "http://localhost/");
        const states = observe(controller);

        await controller.initialize();

        expect(states.at(-1)?.status).toBe("error");
    });

    it("reacts to authenticated callbacks and signs out", async () => {
        vi.useFakeTimers();
        const gateway = new FakeAuthGateway();
        gateway.memberships = [{
            businessId: "business-1",
            businessName: "Test Business",
            role: "manager",
        }];
        const controller = new ManagerAuthController(gateway, "http://localhost/");
        const states = observe(controller);
        await controller.initialize();

        gateway.emitSession({ id: "user-1", email: "manager@example.com" });
        await vi.runAllTimersAsync();
        expect(states.at(-1)?.status).toBe("authenticated");

        await controller.signOut();
        expect(gateway.signOutCalls).toBe(1);
        expect(states.at(-1)).toEqual({ status: "signed-out" });
        vi.useRealTimers();
    });
});
