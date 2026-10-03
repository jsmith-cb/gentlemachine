import {
    renderPlannerPage,
} from "./pages/PlannerPage";

import {
    renderEmployeePlanningPage,
} from "./pages/EmployeePlanningPage";

import {
    renderSchedulePage,
} from "./pages/SchedulePage";

import {
    renderSettingsPage,
} from "./pages/SettingsPage";

import {
    bindSidebar,
    createSidebar,
} from "./components/Sidebar";

import logoIcon from "./assets/pricepocket_logo_icon.png";
import type { PageChangeGuard } from "./components/UnsavedChanges";
import type { AuthenticatedManager } from "./auth/ManagerAuthController";

export interface AppOptions {
    readonly manager: AuthenticatedManager;
    readonly onSignOut: () => Promise<void>;
}

export function renderApp(
    root: HTMLElement,
    options: AppOptions,
): void {
    root.innerHTML = "";

    const shell = document.createElement("div");
    shell.className = "app-shell";

    const {
        sidebar,
        overlay: sidebarOverlay,
    } = createSidebar(options);

    const header = document.createElement("header");
    header.className = "app-header";

    header.innerHTML = `
        <div class="app-header-top">
            <button
                id="hamburger-button"
                class="hamburger-button"
                type="button"
                aria-label="Open menu"
                aria-controls="app-sidebar"
                aria-expanded="false"
            >
                ☰
            </button>

            <img
                class="app-header-logo"
                src="${logoIcon}"
                alt=""
            >

            <div>
                <p class="app-eyebrow">
                    PricePocket
                </p>

                <h1>
                    CREW
                </h1>
            </div>
        </div>
    `;

    const pageContent = document.createElement("main");
    pageContent.id = "page-content";

    shell.appendChild(sidebar);
    shell.appendChild(sidebarOverlay);
    shell.appendChild(header);
    shell.appendChild(pageContent);

    root.appendChild(shell);

    const hamburgerButton = header.querySelector<HTMLButtonElement>(
        "#hamburger-button",
    );

    if (!hamburgerButton) {
        throw new Error("Hamburger button not found");
    }

    const sidebarController = bindSidebar({
        sidebar,
        overlay: sidebarOverlay,
        trigger: hamburgerButton,
    });

    attachNavigationListeners(
        sidebar,
        pageContent,
        () => sidebarController.close(),
    );

    renderSchedulePage(
        pageContent,
    );
}

function attachNavigationListeners(
    sidebar: HTMLElement,
    pageContent: HTMLElement,
    closeSidebar: () => void,
): void {
    let activeChangeGuard: PageChangeGuard | null = null;
    const sidebarPlannerButton = sidebar.querySelector<HTMLButtonElement>(
        "#sidebar-planner-button",
    );

    const sidebarScheduleButton = sidebar.querySelector<HTMLButtonElement>(
        "#sidebar-schedule-button",
    );

    const sidebarEmployeePlanningButton = sidebar.querySelector<HTMLButtonElement>(
        "#sidebar-employee-planning-button",
    );

    const sidebarSettingsButton = sidebar.querySelector<HTMLButtonElement>(
        "#sidebar-settings-button",
    );

    if (
        !sidebarScheduleButton ||
        !sidebarPlannerButton ||
        !sidebarEmployeePlanningButton ||
        !sidebarSettingsButton
    ) {
        throw new Error("Sidebar navigation button not found");
    }

    const setActive = (active: HTMLButtonElement): void => {
        for (const button of [
            sidebarScheduleButton,
            sidebarPlannerButton,
            sidebarEmployeePlanningButton,
            sidebarSettingsButton,
        ]) {
            button.classList.toggle("active", button === active);
        }
    };

    const navigate = async (
        active: HTMLButtonElement,
        render: () => PageChangeGuard | void,
    ): Promise<void> => {
        if (activeChangeGuard?.hasUnsavedChanges() &&
            !await activeChangeGuard.confirmLeave(active)) {
            closeSidebar();
            return;
        }
        setActive(active);
        closeSidebar();
        activeChangeGuard = render() ?? null;
    };

    window.addEventListener("beforeunload", (event) => {
        if (!activeChangeGuard?.hasUnsavedChanges()) return;
        event.preventDefault();
        event.returnValue = "";
    });

    sidebarScheduleButton.addEventListener(
        "click",
        () => void navigate(sidebarScheduleButton, () => renderSchedulePage(pageContent)),
    );

    sidebarPlannerButton.addEventListener(
        "click",
        () => void navigate(sidebarPlannerButton, () => renderPlannerPage(pageContent)),
    );

    sidebarEmployeePlanningButton.addEventListener(
        "click",
        () => void navigate(sidebarEmployeePlanningButton, () => renderEmployeePlanningPage(pageContent)),
    );

    sidebarSettingsButton.addEventListener(
        "click",
        () => void navigate(sidebarSettingsButton, () => renderSettingsPage(pageContent)),
    );
}
