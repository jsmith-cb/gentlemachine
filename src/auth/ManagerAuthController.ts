export interface AuthenticatedUser {
    readonly id: string;
    readonly email: string;
}

export interface ManagerMembership {
    readonly businessId: string;
    readonly businessName: string;
    readonly role: "manager";
}

export interface AuthenticatedManager extends ManagerMembership {
    readonly userId: string;
    readonly email: string;
}

export type ManagerAuthState =
    | { readonly status: "loading"; readonly message: string }
    | { readonly status: "signed-out" }
    | { readonly status: "email-sent"; readonly email: string }
    | { readonly status: "error"; readonly message: string }
    | { readonly status: "missing-membership"; readonly email: string }
    | { readonly status: "authenticated"; readonly manager: AuthenticatedManager };

export interface AuthenticationSessionGateway {
    getSessionUser(): Promise<AuthenticatedUser | null>;
    onSessionChange(listener: (user: AuthenticatedUser | null) => void): () => void;
    requestMagicLink(email: string, redirectUrl: string): Promise<void>;
    signOut(): Promise<void>;
}

export interface ManagerAuthGateway extends AuthenticationSessionGateway {
    findManagerMembership(userId: string): Promise<readonly ManagerMembership[]>;
}

type AuthStateListener = (state: ManagerAuthState) => void;

export class ManagerAuthController {
    private state: ManagerAuthState = {
        status: "loading",
        message: "Checking your session…",
    };

    private readonly listeners = new Set<AuthStateListener>();
    private stopSessionListener: (() => void) | null = null;
    private sessionRevision = 0;

    constructor(
        private readonly gateway: ManagerAuthGateway,
        private readonly redirectUrl: string,
    ) {}

    subscribe(listener: AuthStateListener): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    async initialize(authenticationCallbackError: string | null = null): Promise<void> {
        this.stopSessionListener?.();
        this.stopSessionListener = this.gateway.onSessionChange((user) => {
            queueMicrotask(() => void this.applySession(user));
        });

        this.emit({ status: "loading", message: "Checking your session…" });
        try {
            const user = await this.gateway.getSessionUser();
            if (!user && authenticationCallbackError) {
                this.emit({ status: "error", message: authenticationCallbackError });
                return;
            }
            await this.applySession(user);
        } catch (error) {
            this.emitAuthenticationError(error);
        }
    }

    async requestMagicLink(rawEmail: string): Promise<void> {
        const email = rawEmail.trim();
        if (!email) {
            this.emit({ status: "error", message: "Enter your manager email address." });
            return;
        }

        this.emit({ status: "loading", message: "Sending your secure sign-in link…" });
        try {
            await this.gateway.requestMagicLink(email, this.redirectUrl);
            this.emit({ status: "email-sent", email });
        } catch (error) {
            this.emitAuthenticationError(error);
        }
    }

    async signOut(): Promise<void> {
        this.sessionRevision += 1;
        this.emit({ status: "loading", message: "Signing out…" });
        try {
            await this.gateway.signOut();
            this.emit({ status: "signed-out" });
        } catch (error) {
            this.emitAuthenticationError(error);
        }
    }

    dispose(): void {
        this.stopSessionListener?.();
        this.stopSessionListener = null;
        this.listeners.clear();
    }

    private async applySession(user: AuthenticatedUser | null): Promise<void> {
        const revision = ++this.sessionRevision;
        if (!user) {
            this.emit({ status: "signed-out" });
            return;
        }

        this.emit({ status: "loading", message: "Opening your workspace…" });
        try {
            const memberships = await this.gateway.findManagerMembership(user.id);
            if (revision !== this.sessionRevision) return;

            if (memberships.length === 0) {
                this.emit({ status: "missing-membership", email: user.email });
                return;
            }
            if (memberships.length > 1) {
                this.emit({
                    status: "error",
                    message: "This account belongs to more than one manager workspace. Workspace switching is not available yet.",
                });
                return;
            }

            const membership = memberships[0];
            this.emit({
                status: "authenticated",
                manager: {
                    ...membership,
                    userId: user.id,
                    email: user.email,
                },
            });
        } catch (error) {
            if (revision === this.sessionRevision) this.emitAuthenticationError(error);
        }
    }

    private emitAuthenticationError(error: unknown): void {
        const detail = error instanceof Error && error.message.trim()
            ? error.message
            : "Authentication could not be completed.";
        this.emit({ status: "error", message: detail });
    }

    private emit(state: ManagerAuthState): void {
        this.state = state;
        for (const listener of this.listeners) listener(state);
    }
}
