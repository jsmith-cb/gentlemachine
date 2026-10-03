import logoIcon from "../assets/pricepocket_logo_icon.png";

export interface WorkspaceLoadActions {
    retry(): void;
    signOut(): Promise<void>;
}

export function renderWorkspaceLoadingPage(root: HTMLElement): void {
    root.innerHTML = shell(`
        <div class="auth-state auth-loading" role="status">
            <span class="auth-spinner" aria-hidden="true"></span>
            <h1>Opening your Crew workspace</h1>
            <p>Loading and checking the canonical Team, Planner, Schedule, and Settings data.</p>
        </div>
    `);
}

export function renderWorkspaceLoadErrorPage(
    root: HTMLElement,
    message: string,
    actions: WorkspaceLoadActions,
): void {
    root.innerHTML = shell(`
        <div class="auth-state">
            <p class="section-label">Workspace unavailable</p>
            <h1>Crew could not open safely</h1>
            <p>The canonical workspace could not be loaded. Your local browser data has not been used as a fallback.</p>
            <div class="auth-error" role="alert">${escapeHtml(message)}</div>
            <div class="auth-actions">
                <button class="auth-primary-button" id="workspace-retry" type="button">Try again</button>
                <button class="auth-secondary-button" id="workspace-sign-out" type="button">Sign out</button>
            </div>
        </div>
    `);

    root.querySelector<HTMLButtonElement>("#workspace-retry")
        ?.addEventListener("click", actions.retry);
    root.querySelector<HTMLButtonElement>("#workspace-sign-out")
        ?.addEventListener("click", () => void actions.signOut());
}

function shell(content: string): string {
    return `
        <main class="auth-shell">
            <section class="auth-card" aria-live="polite">
                <div class="auth-brand">
                    <img src="${logoIcon}" alt="">
                    <div>
                        <span>PricePocket</span>
                        <strong>Crew</strong>
                    </div>
                </div>
                ${content}
            </section>
        </main>
    `;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
    })[character] ?? character);
}
