import {
    renderPlannerPage,
} from "./pages/PlannerPage";

export function renderApp(
    root: HTMLElement,
): void {
    root.innerHTML = `
        <div class="app-shell">
            <header class="app-header">
                <div>
                    <p class="app-eyebrow">
                        GentleMachine
                    </p>

                    <h1>
                        Monthly Planner
                    </h1>
                </div>
            </header>

            <main id="page-content"></main>
        </div>
    `;

    const pageContent =
        root.querySelector<HTMLElement>(
            "#page-content",
        );

    if (!pageContent) {
        throw new Error(
            "Page content element not found.",
        );
    }

    renderPlannerPage(
        pageContent,
    );
}