import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
    AuthenticatedUser,
    ManagerAuthGateway,
    ManagerMembership,
} from "../auth/ManagerAuthController";

interface MembershipRow {
    readonly business_id: string;
    readonly role: "manager";
    readonly businesses: {
        readonly id: string;
        readonly name: string;
    } | readonly {
        readonly id: string;
        readonly name: string;
    }[];
}

export class SupabaseManagerAuthGateway implements ManagerAuthGateway {
    constructor(private readonly client: SupabaseClient) {}

    async getSessionUser(): Promise<AuthenticatedUser | null> {
        const { data, error } = await this.client.auth.getSession();
        if (error) throw error;
        return toAuthenticatedUser(data.session?.user ?? null);
    }

    onSessionChange(listener: (user: AuthenticatedUser | null) => void): () => void {
        const { data } = this.client.auth.onAuthStateChange((_event, session) => {
            listener(toAuthenticatedUser(session?.user ?? null));
        });
        return () => data.subscription.unsubscribe();
    }

    async requestMagicLink(email: string, redirectUrl: string): Promise<void> {
        const { error } = await this.client.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: false,
                emailRedirectTo: redirectUrl,
            },
        });
        if (error) throw error;
    }

    async findManagerMembership(userId: string): Promise<readonly ManagerMembership[]> {
        const { data, error } = await this.client
            .from("business_memberships")
            .select("business_id, role, businesses!inner(id, name)")
            .eq("auth_user_id", userId)
            .eq("role", "manager")
            .limit(2);
        if (error) throw error;

        return (data as unknown as MembershipRow[]).map((row) => {
            const business = Array.isArray(row.businesses)
                ? row.businesses[0]
                : row.businesses;
            if (!business || row.role !== "manager") {
                throw new Error("The manager workspace membership is invalid.");
            }
            return {
                businessId: row.business_id,
                businessName: business.name,
                role: "manager",
            };
        });
    }

    async signOut(): Promise<void> {
        const { error } = await this.client.auth.signOut();
        if (error) throw error;
    }
}

function toAuthenticatedUser(user: User | null): AuthenticatedUser | null {
    if (!user) return null;
    if (!user.email) throw new Error("The authenticated manager account has no email address.");
    return { id: user.id, email: user.email };
}
