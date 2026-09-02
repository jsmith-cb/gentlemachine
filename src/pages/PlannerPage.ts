const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
] as const;

export function renderPlannerPage(container: HTMLElement): void {
    container.innerHTML = `
        <section class="planner">
            <div class="planner-intro">
                <div>
                    <p class="section-label">Schedule</p>
                    <h2>This week</h2>
                </div>

                <p class="store-hours">
                    Store hours
                    <strong>10:30–20:30</strong>
                </p>
            </div>

            <div class="week-grid">
                ${DAYS.map(renderDay).join("")}
            </div>
        </section>
    `;
}

function renderDay(day: (typeof DAYS)[number]): string {
    return `
        <article class="day-card">
            <div class="day-header">
                <h3>${day}</h3>
                <span>10:30–20:30</span>
            </div>

            <div class="day-empty">
                <span>No shifts yet</span>
            </div>
        </article>
    `;
}