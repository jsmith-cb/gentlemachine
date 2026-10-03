import logoIcon from "../assets/pricepocket_logo_icon.png";
import type { EmployeePortalState } from "../auth/EmployeePortalController";

export interface EmployeeScheduleActions {
    requestMagicLink(email: string): Promise<void>;
    loadMonth(year: number, month: number): Promise<void>;
    submitTimeOff(startDate: string, endDate: string, note?: string): Promise<void>;
    signOut(): Promise<void>;
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
] as const;

export function renderEmployeeSchedulePage(
    root: HTMLElement,
    state: EmployeePortalState,
    actions: EmployeeScheduleActions,
): void {
    root.innerHTML = `<main class="employee-portal-shell">${content(state)}</main>`;

    root.querySelector<HTMLFormElement>("#employee-portal-sign-in")
        ?.addEventListener("submit", (event) => {
            event.preventDefault();
            const email = new FormData(event.currentTarget as HTMLFormElement).get("email");
            if (typeof email === "string") void actions.requestMagicLink(email);
        });
    root.querySelector<HTMLButtonElement>("[data-employee-sign-out]")
        ?.addEventListener("click", () => void actions.signOut());
    root.querySelectorAll<HTMLButtonElement>("[data-employee-month]").forEach((button) => {
        button.addEventListener("click", () => {
            const [year, month] = String(button.dataset.employeeMonth).split("-").map(Number);
            if (year && month) void actions.loadMonth(year, month);
        });
    });
    root.querySelector<HTMLFormElement>("#time-off-request-form")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget as HTMLFormElement);
        void actions.submitTimeOff(String(data.get("startDate") ?? ""),
            String(data.get("endDate") ?? ""), String(data.get("note") ?? ""));
    });
}

function content(state: EmployeePortalState): string {
    if (state.status === "loading") {
        return portalCard(`
            <div class="employee-portal-state" role="status">
                <span class="auth-spinner" aria-hidden="true"></span>
                <h1>Opening My Schedule</h1>
                <p>${escapeHtml(state.message)}</p>
            </div>
        `);
    }
    if (state.status === "email-sent") {
        return portalCard(`
            <div class="employee-portal-state">
                <p class="section-label">Employee access</p>
                <h1>Check your email</h1>
                <p>We sent a secure sign-in link to <strong>${escapeHtml(state.email)}</strong>.</p>
            </div>
        `);
    }
    if (state.status === "unavailable") {
        return portalCard(`
            <div class="employee-portal-state">
                <p class="section-label">Employee access</p>
                <h1>My Schedule is unavailable</h1>
                <p><strong>${escapeHtml(state.email)}</strong> does not have active employee schedule access.</p>
                <p class="auth-note">Ask your manager to enable access for your Team record.</p>
                <button type="button" class="auth-secondary-button" data-employee-sign-out>Sign out</button>
            </div>
        `);
    }
    if (state.status === "authenticated") return scheduleContent(state);

    const error = state.status === "error"
        ? `<div class="auth-error" role="alert">${escapeHtml(state.message)}</div>`
        : "";
    return portalCard(`
        <div class="employee-portal-state">
            <p class="section-label">Employee access</p>
            <h1>Open My Schedule</h1>
            <p>Enter the email your manager enabled for your Team record.</p>
            ${error}
            <form class="auth-form" id="employee-portal-sign-in">
                <label for="employee-portal-email">Email address</label>
                <input id="employee-portal-email" name="email" type="email" autocomplete="email" required autofocus>
                <button type="submit">Send sign-in link</button>
            </form>
        </div>
    `);
}

function scheduleContent(state: Extract<EmployeePortalState, { status: "authenticated" }>): string {
    const schedule = state.schedule;
    const previous = adjacentMonth(schedule.year, schedule.month, -1);
    const next = adjacentMonth(schedule.year, schedule.month, 1);
    const grouped = new Map<string, typeof schedule.shifts>();
    for (const shift of schedule.shifts) {
        grouped.set(shift.date, [...(grouped.get(shift.date) ?? []), shift]);
    }
    return `
        <header class="employee-portal-header">
            <div class="employee-portal-brand">
                <img src="${logoIcon}" alt="">
                <span><strong>PricePocket Crew</strong><small>${escapeHtml(schedule.businessName)}</small></span>
            </div>
            <button type="button" class="employee-portal-sign-out" data-employee-sign-out>Sign out</button>
        </header>
        <section class="employee-schedule" aria-labelledby="employee-schedule-title">
            <p class="section-label">My Schedule</p>
            <h1 id="employee-schedule-title">${escapeHtml(schedule.employee.firstName)} ${escapeHtml(schedule.employee.lastName)}</h1>
            <div class="employee-schedule-period">
                <button type="button" data-employee-month="${previous.year}-${previous.month}" aria-label="Previous month">←</button>
                <h2>${MONTHS[schedule.month - 1]} ${schedule.year}</h2>
                <button type="button" data-employee-month="${next.year}-${next.month}" aria-label="Next month">→</button>
            </div>
            <div class="employee-shift-list">
                ${grouped.size ? [...grouped.entries()].map(([date, shifts]) => `
                    <article class="employee-shift-day">
                        <time datetime="${date}">${formatDate(date)}</time>
                        <div>${shifts.map((shift) => `<p><strong>${escapeHtml(shift.start)}–${escapeHtml(shift.end)}</strong></p>`).join("")}</div>
                    </article>
                `).join("") : `
                    <div class="employee-schedule-empty">
                        <h3>No shifts scheduled for this month.</h3>
                        <p>There are currently no saved shifts in this period.</p>
                    </div>
                `}
            </div>
            <section class="employee-time-off" aria-labelledby="time-off-heading">
                <div><p class="section-label">Time off</p><h2 id="time-off-heading">Request Time Off</h2></div>
                <form id="time-off-request-form" class="employee-time-off-form">
                    <label>Start date<input type="date" name="startDate" required></label>
                    <label>End date<input type="date" name="endDate" required></label>
                    <label class="employee-time-off-note">Note (optional)<textarea name="note" maxlength="500" rows="2"></textarea></label>
                    <button type="submit">Submit request</button>
                </form>
                ${scheduleStateMessage(state)}
                <div class="employee-time-off-list">
                    ${state.requests.length ? state.requests.map((request) => `
                        <article><div><strong>${formatDate(request.startDate)}${request.startDate === request.endDate ? "" : ` – ${formatDate(request.endDate)}`}</strong>
                        <span class="time-off-status time-off-status--${request.status}">${statusLabel(request.status)}</span></div>
                        ${request.employeeNote ? `<p>${escapeHtml(request.employeeNote)}</p>` : ""}
                        ${request.managerNote ? `<p><strong>Manager note:</strong> ${escapeHtml(request.managerNote)}</p>` : ""}
                        </article>`).join("") : "<p>No time-off requests yet.</p>"}
                </div>
            </section>
        </section>
    `;
}

function scheduleStateMessage(schedule: Extract<EmployeePortalState, { status: "authenticated" }>): string {
    return schedule.requestMessage ? `<p class="employee-time-off-message" role="status">${escapeHtml(schedule.requestMessage)}</p>` : "";
}

function statusLabel(status: "pending" | "approved" | "declined" | "superseded"): string {
    return status[0].toUpperCase() + status.slice(1);
}

function portalCard(body: string): string {
    return `<section class="auth-card employee-portal-card">
        <div class="auth-brand"><img src="${logoIcon}" alt=""><div><span>PricePocket</span><strong>Crew</strong></div></div>
        ${body}
    </section>`;
}

function adjacentMonth(year: number, month: number, amount: number) {
    const date = new Date(Date.UTC(year, month - 1 + amount, 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function formatDate(value: string): string {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
        weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character] ?? character);
}
