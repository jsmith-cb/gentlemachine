import logoIcon from "../assets/pricepocket_logo_icon.png";
import type { ManagerAuthState } from "../auth/ManagerAuthController";

export interface ManagerSignInActions {
    requestMagicLink(email: string): Promise<void>;
    signOut(): Promise<void>;
}

export function renderManagerSignInPage(
    root: HTMLElement,
    state: Exclude<ManagerAuthState, { status: "authenticated" }>,
    actions: ManagerSignInActions,
): void {
    root.innerHTML = `
        <main class="auth-shell">
            <section class="auth-card" aria-live="polite">
                <div class="auth-brand">
                    <img src="${logoIcon}" alt="">
                    <div>
                        <span>PricePocket</span>
                        <strong>Crew</strong>
                    </div>
                </div>
                ${contentForState(state)}
            </section>
        </main>
    `;

    root.querySelector<HTMLFormElement>("#manager-sign-in-form")
        ?.addEventListener("submit", (event) => {
            event.preventDefault();
            const form = event.currentTarget as HTMLFormElement;
            const email = new FormData(form).get("email");
            if (typeof email === "string") void actions.requestMagicLink(email);
        });

    root.querySelector<HTMLButtonElement>("#auth-sign-out")
        ?.addEventListener("click", () => void actions.signOut());
}

function contentForState(
    state: Exclude<ManagerAuthState, { status: "authenticated" }>,
): string {
    if (state.status === "loading") {
        return `
            <div class="auth-state auth-loading" role="status">
                <span class="auth-spinner" aria-hidden="true"></span>
                <h1>Opening PricePocket Crew</h1>
                <p>${escapeHtml(state.message)}</p>
            </div>
        `;
    }

    if (state.status === "email-sent") {
        return `
            <div class="auth-state">
                <p class="section-label">Secure sign in</p>
                <h1>Check your email</h1>
                <p>We sent a sign-in link to <strong>${escapeHtml(state.email)}</strong>.</p>
                <p class="auth-note">Open the link in this browser to continue to your Crew workspace.</p>
            </div>
        `;
    }

    if (state.status === "missing-membership") {
        return `
            <div class="auth-state">
                <p class="section-label">Workspace access</p>
                <h1>No Crew workspace assigned</h1>
                <p><strong>${escapeHtml(state.email)}</strong> is authenticated, but it does not have an authorized manager membership.</p>
                <p class="auth-note">Ask the workspace administrator to add this account, then sign in again.</p>
                <button class="auth-secondary-button" id="auth-sign-out" type="button">Sign out</button>
            </div>
        `;
    }

    const error = state.status === "error"
        ? `<div class="auth-error" role="alert">${escapeHtml(state.message)}</div>`
        : "";

    return `
        <div class="auth-state">
            <p class="section-label">Manager access</p>
            <h1>Sign in to Crew</h1>
            <p>Enter your authorized manager email. We’ll send you a secure sign-in link.</p>
            ${error}
            <form class="auth-form" id="manager-sign-in-form">
                <label for="manager-email">Email address</label>
                <input id="manager-email" name="email" type="email" autocomplete="email" required autofocus>
                <button type="submit">Send sign-in link</button>
            </form>
            <p class="auth-note">Access is limited to existing manager accounts. This form cannot create a new account.</p>
        </div>
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
