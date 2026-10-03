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
import { SupabaseCrewRepository } from "./infrastructure/SupabaseCrewRepository";
import { CrewApplicationStore } from "./state/CrewApplicationStore";
import {
    renderWorkspaceLoadErrorPage,
    renderWorkspaceLoadingPage,
} from "./pages/WorkspaceLoadPage";
import { SupabaseEmployeeAccessRepository } from "./infrastructure/SupabaseEmployeeAccessRepository";

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
        let activeStore: CrewApplicationStore | null = null;
        let unsubscribeStore: (() => void) | null = null;

        const clearWorkspace = (): void => {
            unsubscribeStore?.();
            unsubscribeStore = null;
            activeStore?.invalidate();
            activeStore = null;
            activeManagerKey = null;
        };

        controller.subscribe((state) => {
            if (state.status === "authenticated") {
                const managerKey = `${state.manager.userId}:${state.manager.businessId}`;
                if (activeManagerKey === managerKey) return;
                clearWorkspace();
                activeManagerKey = managerKey;
                const store = new CrewApplicationStore(
                    new SupabaseCrewRepository(client, state.manager.businessId),
                );
                activeStore = store;
                let applicationRendered = false;

                unsubscribeStore = store.subscribe((workspaceState) => {
                    if (activeStore !== store || activeManagerKey !== managerKey) return;
                    if (workspaceState.status === "loading") {
                        renderWorkspaceLoadingPage(applicationRoot);
                    } else if (workspaceState.status === "error") {
                        renderWorkspaceLoadErrorPage(
                            applicationRoot,
                            workspaceState.error.message,
                            {
                                retry: () => void store.load(),
                                signOut: () => controller.signOut(),
                            },
                        );
                    } else if (workspaceState.status === "ready" && !applicationRendered) {
                        applicationRendered = true;
                        renderApp(applicationRoot, {
                            manager: state.manager,
                            onSignOut: () => controller.signOut(),
                            store,
                            employeeAccessRepository: new SupabaseEmployeeAccessRepository(
                                client,
                                state.manager.businessId,
                            ),
                        });
                    }
                });
                void store.load();
                return;
            }

            clearWorkspace();
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
