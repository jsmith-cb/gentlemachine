import "./styles/planner.css";
import "./styles/sidebar.css";
import "./styles/employee-planning.css";
import "./styles/day-planning.css";
import "./styles/schedule.css";
import "./styles/settings.css";
import "./styles/unsaved-changes.css";
import "./styles/auth.css";
import { renderApp } from "./app";
import { initializeTheme } from "./theme/Theme";
import { ManagerAuthController } from "./auth/ManagerAuthController";
import { renderManagerSignInPage } from "./pages/ManagerSignInPage";
import {
    createSupabaseBrowserClient,
    clearAuthenticationCallbackError,
    readAuthenticationCallbackError,
    readSupabaseBrowserConfig,
} from "./infrastructure/supabaseClient";
import { SupabaseManagerAuthGateway } from "./infrastructure/SupabaseManagerAuthGateway";

initializeTheme();

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
    throw new Error("App root element not found.");
}

startAuthenticatedApplication(root);

function startAuthenticatedApplication(applicationRoot: HTMLElement): void {
    try {
        const client = createSupabaseBrowserClient(readSupabaseBrowserConfig());
        const redirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
        const callbackError = readAuthenticationCallbackError(window.location.href);
        clearAuthenticationCallbackError(window.location.href);
        const controller = new ManagerAuthController(
            new SupabaseManagerAuthGateway(client),
            redirectUrl,
        );
        let activeManagerKey: string | null = null;

        controller.subscribe((state) => {
            if (state.status === "authenticated") {
                const managerKey = `${state.manager.userId}:${state.manager.businessId}`;
                if (activeManagerKey === managerKey) return;
                activeManagerKey = managerKey;
                renderApp(applicationRoot, {
                    manager: state.manager,
                    onSignOut: () => controller.signOut(),
                });
                return;
            }

            activeManagerKey = null;
            renderManagerSignInPage(applicationRoot, state, {
                requestMagicLink: (email) => controller.requestMagicLink(email),
                signOut: () => controller.signOut(),
            });
        });

        void controller.initialize(callbackError);
    } catch (error) {
        renderManagerSignInPage(applicationRoot, {
            status: "error",
            message: error instanceof Error
                ? error.message
                : "PP_Crew authentication could not be initialized.",
        }, {
            requestMagicLink: async () => undefined,
            signOut: async () => undefined,
        });
    }
}
