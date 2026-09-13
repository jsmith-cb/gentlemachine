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

    const header = document.createElement("header");
    header.className = "app-header";

    header.innerHTML = `
        <div>
            <p class="app-eyebrow">
                PricePocket
            </p>

            <h1>
                CREW
            </h1>
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

    shell.appendChild(header);
    shell.appendChild(pageContent);

    root.appendChild(shell);

    attachNavigationListeners(
        header,
        pageContent,
    );

    renderPlannerPage(
        pageContent,
    );
}

function attachNavigationListeners(
    header: HTMLElement,
    pageContent: HTMLElement,
): void {
    const plannerButton = header.querySelector<HTMLButtonElement>(
        "#planner-button",
    )!;

    const employeePlanningButton = header.querySelector<HTMLButtonElement>(
        "#employee-planning-button",
    )!;

    for (const button of [plannerButton, employeePlanningButton]) {
        if (!button) {
            throw new Error("Navigation button not found");
        }

        button.addEventListener(
            "click",
            () => {
                const pageName = button.id.replace("-button", "");

                if (pageName === "planner") {
                    renderPlannerPage(pageContent);
                } else {
                    renderEmployeePlanningPage(pageContent);
                }
            },
        );
    }
}
