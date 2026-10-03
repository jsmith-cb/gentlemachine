import type {
    AuthenticatedUser,
    AuthenticationSessionGateway,
} from "./ManagerAuthController";
import type {
    EmployeeScheduleDocument,
    EmployeeScheduleRepository,
} from "../repositories/EmployeeScheduleRepository";

export type EmployeePortalState =
    | { readonly status: "loading"; readonly message: string }
    | { readonly status: "signed-out" }
    | { readonly status: "email-sent"; readonly email: string }
    | { readonly status: "error"; readonly message: string }
    | { readonly status: "unavailable"; readonly email: string }
    | {
        readonly status: "authenticated";
        readonly user: AuthenticatedUser;
        readonly schedule: EmployeeScheduleDocument;
      };

type Listener = (state: EmployeePortalState) => void;

export class EmployeePortalController {
    private state: EmployeePortalState = { status: "loading", message: "Checking your session…" };
    private readonly listeners = new Set<Listener>();
    private stopSessionListener: (() => void) | null = null;
    private revision = 0;

    constructor(
        private readonly session: AuthenticationSessionGateway,
        private readonly schedules: EmployeeScheduleRepository,
        private readonly redirectUrl: string,
    ) {}

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    async initialize(callbackError: string | null = null): Promise<void> {
        this.stopSessionListener?.();
        this.stopSessionListener = this.session.onSessionChange((user) => {
            queueMicrotask(() => void this.applySession(user));
        });
        try {
            const user = await this.session.getSessionUser();
            if (!user && callbackError) return this.emit({ status: "error", message: callbackError });
            await this.applySession(user);
        } catch (error) {
            this.emitError(error);
        }
    }

    async requestMagicLink(rawEmail: string): Promise<void> {
        const email = rawEmail.trim();
        if (!email) return this.emit({ status: "error", message: "Enter your employee email address." });
        this.emit({ status: "loading", message: "Sending your secure sign-in link…" });
        try {
            await this.session.requestMagicLink(email, this.redirectUrl);
            this.emit({ status: "email-sent", email });
        } catch (error) {
            this.emitError(error);
        }
    }

    async loadMonth(year: number, month: number): Promise<void> {
        if (this.state.status !== "authenticated") return;
        const user = this.state.user;
        const revision = ++this.revision;
        this.emit({ status: "loading", message: "Loading your schedule…" });
        try {
            const schedule = await this.schedules.getMySchedule(year, month);
            if (revision === this.revision) this.emit({ status: "authenticated", user, schedule });
        } catch (error) {
            if (revision !== this.revision) return;
            if (isAccessUnavailable(error)) {
                this.emit({ status: "unavailable", email: user.email });
            } else {
                this.emitError(error);
            }
        }
    }

    async signOut(): Promise<void> {
        this.revision += 1;
        this.emit({ status: "loading", message: "Signing out…" });
        try {
            await this.session.signOut();
            this.emit({ status: "signed-out" });
        } catch (error) {
            this.emitError(error);
        }
    }

    private async applySession(user: AuthenticatedUser | null): Promise<void> {
        const revision = ++this.revision;
        if (!user) return this.emit({ status: "signed-out" });
        this.emit({ status: "loading", message: "Opening your schedule…" });
        const now = new Date();
        try {
            const schedule = await this.schedules.getMySchedule(now.getFullYear(), now.getMonth() + 1);
            if (revision === this.revision) this.emit({ status: "authenticated", user, schedule });
        } catch (error) {
            if (revision !== this.revision) return;
            if (isAccessUnavailable(error)) {
                this.emit({ status: "unavailable", email: user.email });
            } else {
                this.emitError(error);
            }
        }
    }

    private emitError(error: unknown): void {
        this.emit({
            status: "error",
            message: error instanceof Error && error.message.trim()
                ? error.message
                : "Your employee schedule could not be opened.",
        });
    }

    private emit(state: EmployeePortalState): void {
        this.state = state;
        for (const listener of this.listeners) listener(state);
    }
}

function isAccessUnavailable(error: unknown): boolean {
    return error instanceof Error && /access is unavailable|permission denied|not authorized/i.test(error.message);
}
