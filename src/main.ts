import "./styles/planner.css";
import "./styles/sidebar.css";
import "./styles/employee-planning.css";
import "./styles/day-planning.css";
import "./styles/schedule.css";
import "./styles/settings.css";
import "./styles/unsaved-changes.css";
import "./styles/auth.css";
import "./styles/employee-portal.css";
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
import { SupabaseEmployeeScheduleRepository } from "./infrastructure/SupabaseEmployeeScheduleRepository";
import { EmployeePortalController } from "./auth/EmployeePortalController";
import { renderEmployeeSchedulePage } from "./pages/EmployeeSchedulePage";
import { SupabaseEmployeeTimeOffRequestRepository, SupabaseManagerTimeOffRequestRepository } from "./infrastructure/SupabaseTimeOffRequestRepository";

initializeTheme();

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
    throw new Error("App root element not found.");
}

if (isEmployeePortalRoute(window.location.pathname)) {
    startEmployeePortal(root);
} else {
    startManagerApplication(root);
}

function startManagerApplication(applicationRoot: HTMLElement): void {
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
        let employeeRedirectRevision = 0;

        const clearWorkspace = (): void => {
            unsubscribeStore?.();
            unsubscribeStore = null;
            activeStore?.invalidate();
            activeStore = null;
            activeManagerKey = null;
        };

        controller.subscribe((state) => {
            const redirectRevision = ++employeeRedirectRevision;
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
                            timeOffRequestRepository: new SupabaseManagerTimeOffRequestRepository(
                                client,
                                state.manager.businessId,
                            ),
                        });
                    }
                });
                void store.load();
                return;
            }

            if (state.status === "missing-membership") {
                clearWorkspace();
                renderManagerSignInPage(applicationRoot, {
                    status: "loading",
                    message: "Checking employee schedule access…",
                }, {
                    requestMagicLink: (email) => controller.requestMagicLink(email),
                    signOut: () => controller.signOut(),
                });
                const now = new Date();
                void new SupabaseEmployeeScheduleRepository(client)
                    .getMySchedule(now.getFullYear(), now.getMonth() + 1)
                    .then(() => {
                        if (redirectRevision === employeeRedirectRevision) {
                            window.location.replace(employeePortalUrl());
                        }
                    })
                    .catch(() => {
                        if (redirectRevision !== employeeRedirectRevision) return;
                        renderManagerSignInPage(applicationRoot, state, {
                            requestMagicLink: (email) => controller.requestMagicLink(email),
                            signOut: () => controller.signOut(),
                        });
                    });
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

function startEmployeePortal(applicationRoot: HTMLElement): void {
    try {
        const client = createSupabaseBrowserClient(readSupabaseBrowserConfig());
        const callbackError = readAuthenticationCallbackError(window.location.href);
        clearAuthenticationCallbackError(window.location.href);
        const controller = new EmployeePortalController(
            new SupabaseManagerAuthGateway(client),
            new SupabaseEmployeeScheduleRepository(client),
            new SupabaseEmployeeTimeOffRequestRepository(client),
            employeePortalUrl(),
        );
        controller.subscribe((state) => {
            renderEmployeeSchedulePage(applicationRoot, state, {
                requestMagicLink: (email) => controller.requestMagicLink(email),
                loadMonth: (year, month) => controller.loadMonth(year, month),
                submitTimeOff: (startDate, endDate, note) => controller.submitTimeOff(startDate, endDate, note),
                signOut: () => controller.signOut(),
            });
        });
        void controller.initialize(callbackError);
    } catch (error) {
        renderEmployeeSchedulePage(applicationRoot, {
            status: "error",
            message: error instanceof Error ? error.message : "My Schedule could not be initialized.",
        }, {
            requestMagicLink: async () => undefined,
            loadMonth: async () => undefined,
            submitTimeOff: async () => undefined,
            signOut: async () => undefined,
        });
    }
}

function employeePortalUrl(): string {
    return new URL(`${import.meta.env.BASE_URL}my-schedule`, window.location.origin).toString();
}

function isEmployeePortalRoute(pathname: string): boolean {
    const expected = new URL(`${import.meta.env.BASE_URL}my-schedule`, window.location.origin).pathname;
    return pathname.replace(/\/$/, "") === expected.replace(/\/$/, "");
}
