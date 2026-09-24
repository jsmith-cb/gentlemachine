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

export function renderApp(
    root: HTMLElement,
): void {
    root.innerHTML = "";

    const shell = document.createElement("div");
    shell.className = "app-shell";

    const {
        sidebar,
        overlay: sidebarOverlay,
    } = createSidebar();

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

    sidebarScheduleButton.addEventListener(
        "click",
        () => {
            setActive(sidebarScheduleButton);
            closeSidebar();
            renderSchedulePage(pageContent);
        },
    );

    sidebarPlannerButton.addEventListener(
        "click",
        () => {
            setActive(sidebarPlannerButton);

            closeSidebar();
            renderPlannerPage(pageContent);
        },
    );

    sidebarEmployeePlanningButton.addEventListener(
        "click",
        () => {
            setActive(sidebarEmployeePlanningButton);

            closeSidebar();
            renderEmployeePlanningPage(pageContent);
        },
    );

    sidebarSettingsButton.addEventListener(
        "click",
        () => {
            setActive(sidebarSettingsButton);
            closeSidebar();
            renderSettingsPage(pageContent);
        },
    );
}
