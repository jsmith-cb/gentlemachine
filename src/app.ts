import {
    renderPlannerPage,
} from "./pages/PlannerPage";

import {
    renderEmployeePlanningPage,
} from "./pages/EmployeePlanningPage";

export function renderApp(
    root: HTMLElement,
): void {
    root.innerHTML = "";

    const shell = document.createElement("div");
    shell.className = "app-shell";

    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar";

    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <span class="sidebar-logo-text">
                <h2>PricePocket</h2>
                <span>CREW</span>
            </span>
        </div>

        <nav class="sidebar-nav" aria-label="Pages">
            <button
                class="sidebar-button active"
                id="sidebar-planner-button"
                type="button"
            >
                Planner
            </button>

            <button
                class="sidebar-button"
                id="sidebar-employee-planning-button"
                type="button"
            >
                Employee Planning
            </button>
        </nav>
    `;

    const header = document.createElement("header");
    header.className = "app-header";

    header.innerHTML = `
        <div class="app-header-top">
            <button
                id="hamburger-button"
                class="hamburger-button"
                type="button"
                aria-label="Open menu"
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

        <nav class="page-navigation" aria-label="Pages">
            <button
                id="planner-button"
                type="button"
            >
                Planner
            </button>

            <button
                id="employee-planning-button"
                type="button"
            >
                Employee Planning
            </button>
        </nav>
    `;

    const pageContent = document.createElement("main");
    pageContent.id = "page-content";

    shell.appendChild(sidebar);
    shell.appendChild(header);
    shell.appendChild(pageContent);

    root.appendChild(shell);

    attachNavigationListeners(
        header,
        sidebar,
        pageContent,
    );

    const hamburgerButton = header.querySelector<HTMLButtonElement>(
        "#hamburger-button",
    )!;

    hamburgerButton.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });

    renderPlannerPage(
        pageContent,
    );
}

function attachNavigationListeners(
    header: HTMLElement,
    sidebar: HTMLElement,
    pageContent: HTMLElement,
): void {
    const plannerButton = header.querySelector<HTMLButtonElement>(
        "#planner-button",
    )!;

    const employeePlanningButton = header.querySelector<HTMLButtonElement>(
        "#employee-planning-button",
    )!;

    const sidebarPlannerButton = sidebar.querySelector<HTMLButtonElement>(
        "#sidebar-planner-button",
    )!;

    const sidebarEmployeePlanningButton = sidebar.querySelector<HTMLButtonElement>(
        "#sidebar-employee-planning-button",
    )!;

    for (const button of [
        plannerButton,
        employeePlanningButton,
        sidebarPlannerButton,
        sidebarEmployeePlanningButton,
    ]) {
        if (!button) {
            throw new Error("Navigation button not found");
        }

        button.addEventListener(
            "click",
            () => {
                const pageName = button.id
                    .replace("sidebar-", "")
                    .replace("-button", "");

                const isActive = (b: HTMLButtonElement, name: string) =>
                    b.id === `sidebar-${name}-button`;

                sidebarPlannerButton.classList.toggle(
                    "active",
                    isActive(sidebarPlannerButton, "planner")
                        ? pageName === "planner"
                        : false,
                );

                sidebarEmployeePlanningButton.classList.toggle(
                    "active",
                    pageName === "employee-planning",
                );

                sidebar.classList.remove("open");

                if (pageName === "planner") {
                    renderPlannerPage(pageContent);
                } else {
                    renderEmployeePlanningPage(pageContent);
                }
            },
        );
    }
}
