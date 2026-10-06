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
import type { CrewApplicationStore } from "./state/CrewApplicationStore";
import type { EmployeeAccessRepository } from "./repositories/EmployeeAccessRepository";
import type { ManagerTimeOffRequestRepository } from "./repositories/TimeOffRequestRepository";
import type { ManagerSickReportRepository } from "./repositories/SickReportRepository";
import {
    readManagerPagePreference,
    writeManagerPagePreference,
} from "./navigation/ManagerPagePreference";
import type { ManagerPage } from "./navigation/ManagerPagePreference";

export interface AppOptions {
    readonly manager: AuthenticatedManager;
    readonly onSignOut: () => Promise<void>;
    readonly store: CrewApplicationStore;
    readonly employeeAccessRepository: EmployeeAccessRepository;
    readonly timeOffRequestRepository: ManagerTimeOffRequestRepository;
    readonly sickReportRepository: ManagerSickReportRepository;
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

    initializeNavigation(
        sidebar,
        pageContent,
        () => sidebarController.close(),
        options.store,
        options.employeeAccessRepository,
        options.timeOffRequestRepository,
        options.sickReportRepository,
    );

}

function initializeNavigation(
    sidebar: HTMLElement,
    pageContent: HTMLElement,
    closeSidebar: () => void,
    store: CrewApplicationStore,
    employeeAccessRepository: EmployeeAccessRepository,
    timeOffRequestRepository: ManagerTimeOffRequestRepository,
    sickReportRepository: ManagerSickReportRepository,
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

    const buttonForPage = (page: ManagerPage): HTMLButtonElement => ({
        schedule: sidebarScheduleButton,
        planner: sidebarPlannerButton,
        team: sidebarEmployeePlanningButton,
        settings: sidebarSettingsButton,
    })[page];

    const renderPage = (page: ManagerPage): PageChangeGuard | void => {
        switch (page) {
            case "schedule":
                return renderSchedulePage(pageContent, store);
            case "planner":
                return renderPlannerPage(pageContent, store);
            case "team":
                return renderEmployeePlanningPage(
                    pageContent, store, employeeAccessRepository,
                    timeOffRequestRepository, sickReportRepository,
                );
            case "settings":
                return renderSettingsPage(pageContent, store);
        }
    };

    const navigate = async (
        page: ManagerPage,
    ): Promise<void> => {
        const active = buttonForPage(page);
        if (activeChangeGuard?.hasUnsavedChanges() &&
            !await activeChangeGuard.confirmLeave(active)) {
            closeSidebar();
            return;
        }
        setActive(active);
        closeSidebar();
        activeChangeGuard = renderPage(page) ?? null;
        writeManagerPagePreference(window.localStorage, page);
    };

    window.addEventListener("beforeunload", (event) => {
        if (!activeChangeGuard?.hasUnsavedChanges()) return;
        event.preventDefault();
        event.returnValue = "";
    });

    sidebarScheduleButton.addEventListener(
        "click",
        () => void navigate("schedule"),
    );

    sidebarPlannerButton.addEventListener(
        "click",
        () => void navigate("planner"),
    );

    sidebarEmployeePlanningButton.addEventListener(
        "click",
        () => void navigate("team"),
    );

    sidebarSettingsButton.addEventListener(
        "click",
        () => void navigate("settings"),
    );

    const initialPage = readManagerPagePreference(window.localStorage);
    setActive(buttonForPage(initialPage));
    activeChangeGuard = renderPage(initialPage) ?? null;
}
