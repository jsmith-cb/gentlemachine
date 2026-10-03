import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseBrowserConfig {
    readonly url: string;
    readonly publishableKey: string;
}

export function readSupabaseBrowserConfig(
    environment: Record<string, string | boolean | undefined> = import.meta.env,
): SupabaseBrowserConfig {
    const url = environment.VITE_SUPABASE_URL;
    const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (typeof url !== "string" || !isHttpUrl(url)) {
        throw new Error("PP_Crew authentication is not configured. Set VITE_SUPABASE_URL.");
    }
    if (typeof publishableKey !== "string" || !isBrowserSafeKey(publishableKey)) {
        throw new Error("PP_Crew authentication requires a browser-safe Supabase publishable key.");
    }

    return { url, publishableKey };
}

export function createSupabaseBrowserClient(
    config: SupabaseBrowserConfig,
): SupabaseClient {
    return createClient(config.url, config.publishableKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });
}

export function readAuthenticationCallbackError(urlValue: string): string | null {
    const url = new URL(urlValue);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const description = hash.get("error_description") ?? url.searchParams.get("error_description");
    if (description) return description;

    const error = hash.get("error") ?? url.searchParams.get("error");
    return error ? "Authentication could not be completed." : null;
}

export function clearAuthenticationCallbackError(urlValue: string): void {
    if (!readAuthenticationCallbackError(urlValue)) return;
    const url = new URL(urlValue);
    url.hash = "";
    url.searchParams.delete("error");
    url.searchParams.delete("error_code");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

function isHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

function isBrowserSafeKey(value: string): boolean {
    if (value.startsWith("sb_publishable_") && value.length > "sb_publishable_".length) {
        return true;
    }
    if (!value.includes(".")) return false;

    try {
        const payload = JSON.parse(decodeBase64Url(value.split(".")[1])) as { role?: unknown };
        return payload.role === "anon";
    } catch {
        return false;
    }
}

function decodeBase64Url(value: string): string {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
}
