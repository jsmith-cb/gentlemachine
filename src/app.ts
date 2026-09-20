import {
    renderPlannerPage,
} from "./pages/PlannerPage";

import {
    renderEmployeePlanningPage,
} from "./pages/EmployeePlanningPage";

import {
    bindSidebar,
    createSidebar,
} from "./components/Sidebar";

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

    renderPlannerPage(
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

    const sidebarEmployeePlanningButton = sidebar.querySelector<HTMLButtonElement>(
        "#sidebar-employee-planning-button",
    );

    if (
        !sidebarPlannerButton ||
        !sidebarEmployeePlanningButton
    ) {
        throw new Error("Sidebar navigation button not found");
    }

    sidebarPlannerButton.addEventListener(
        "click",
        () => {
            sidebarPlannerButton.classList.add("active");
            sidebarEmployeePlanningButton.classList.remove("active");

            closeSidebar();
            renderPlannerPage(pageContent);
        },
    );

    sidebarEmployeePlanningButton.addEventListener(
        "click",
        () => {
            sidebarPlannerButton.classList.remove("active");
            sidebarEmployeePlanningButton.classList.add("active");

            closeSidebar();
            renderEmployeePlanningPage(pageContent);
        },
    );
}