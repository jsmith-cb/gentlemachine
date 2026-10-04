import { describe, expect, it } from "vitest";
import {
    readAuthenticationCallbackError,
    readSupabaseBrowserConfig,
} from "./supabaseClient";

describe("readSupabaseBrowserConfig", () => {
    it("accepts a browser-safe publishable key", () => {
        expect(readSupabaseBrowserConfig({
            VITE_SUPABASE_URL: "http://127.0.0.1:54321",
            VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test-key",
        })).toEqual({
            url: "http://127.0.0.1:54321",
            publishableKey: "sb_publishable_test-key",
        });
    });

    it("rejects a privileged secret key", () => {
        expect(() => readSupabaseBrowserConfig({
            VITE_SUPABASE_URL: "http://127.0.0.1:54321",
            VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_never-in-browser",
        })).toThrow("browser-safe Supabase publishable key");
    });

    it("rejects missing project configuration", () => {
        expect(() => readSupabaseBrowserConfig({})).toThrow("VITE_SUPABASE_URL");
    });

    it("reads authentication failures returned in the callback hash", () => {
        expect(readAuthenticationCallbackError(
            "http://localhost/#error=access_denied&error_description=Email+link+has+expired",
        )).toBe("Email link has expired");
    });
});
