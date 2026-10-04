import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

interface EnableRequest { employeeId?: unknown }

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return response(405, { error: "Method not allowed." });

    try {
        const authorization = request.headers.get("Authorization");
        if (!authorization) return response(401, { error: "Authentication is required." });
        const supabaseUrl = requiredEnvironment("SUPABASE_URL");
        const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
            requiredEnvironment("SUPABASE_PUBLISHABLE_KEY");
        const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
        const portalRedirectUrl = requiredEnvironment("EMPLOYEE_PORTAL_REDIRECT_URL");
        const input = await request.json() as EnableRequest;
        if (typeof input.employeeId !== "string" || !isUuid(input.employeeId)) {
            return response(400, { error: "A valid Employee identity is required." });
        }

        const managerClient = createClient(supabaseUrl, publishableKey, {
            global: { headers: { Authorization: authorization } },
            auth: { persistSession: false },
        });
        const { data: session, error: sessionError } = await managerClient.auth.getUser();
        if (sessionError || !session.user) return response(401, { error: "Manager authentication is invalid." });
        const { data: employee, error: employeeError } = await managerClient
            .from("employees")
            .select("id, business_id, email, status")
            .eq("id", input.employeeId)
            .maybeSingle();
        if (employeeError) throw employeeError;
        if (!employee) return response(403, { error: "This Employee is not available in your authorized business." });
        if (employee.status !== "active") return response(409, { error: "Inactive team members cannot use the employee portal." });
        const email = typeof employee.email === "string" ? employee.email.trim().toLowerCase() : "";
        if (!email) return response(409, { error: "Save an Employee email before enabling portal access." });

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: existingAccess, error: accessError } = await adminClient
            .from("employee_access")
            .select("auth_user_id, invited_at")
            .eq("employee_id", employee.id)
            .maybeSingle();
        if (accessError) throw accessError;

        let authUser = existingAccess
            ? (await adminClient.auth.admin.getUserById(existingAccess.auth_user_id)).data.user
            : null;
        if (authUser?.email?.trim().toLowerCase() !== email) authUser = null;
        if (!authUser) authUser = await findVerifiedUserByEmail(adminClient, email);

        let invitationSent = false;
        if (!authUser) {
            const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
                redirectTo: portalRedirectUrl,
            });
            if (error) throw error;
            if (!data.user) throw new Error("Supabase did not return the invited Auth identity.");
            authUser = data.user;
            invitationSent = true;
        }

        const { error: saveError } = await adminClient.from("employee_access").upsert({
            employee_id: employee.id,
            business_id: employee.business_id,
            auth_user_id: authUser.id,
            access_enabled: true,
            invited_at: existingAccess?.invited_at ?? new Date().toISOString(),
        }, { onConflict: "employee_id" });
        if (saveError) {
            if (saveError.code === "23505") {
                return response(409, { error: "This sign-in identity is already linked to another team member." });
            }
            throw saveError;
        }
        return response(200, { status: "enabled", invitationSent });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Employee access could not be enabled.";
        return response(500, { error: message });
    }
});

async function findVerifiedUserByEmail(
    adminClient: ReturnType<typeof createClient>,
    email: string,
) {
    for (let page = 1; page <= 10; page += 1) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
        if (error) throw error;
        const match = data.users.find((user) =>
            user.email?.trim().toLowerCase() === email && Boolean(user.email_confirmed_at));
        if (match) return match;
        if (data.users.length < 100) return null;
    }
    throw new Error("The Auth user directory is too large to resolve this email safely.");
}

function requiredEnvironment(name: string): string {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`The trusted function is missing ${name}.`);
    return value;
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function response(status: number, body: Record<string, unknown>): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}
