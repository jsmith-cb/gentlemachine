import logoIcon from "../assets/pricepocket_logo_icon.png";

export interface SidebarElements {
    readonly sidebar: HTMLElement;
    readonly overlay: HTMLButtonElement;
}

interface BindSidebarOptions extends SidebarElements {
    readonly trigger: HTMLButtonElement;
}

export interface SidebarController {
    close(restoreFocus?: boolean): void;
}

export function createSidebar(): SidebarElements {
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar";
    sidebar.id = "app-sidebar";
    sidebar.innerHTML = `
        <button
            class="sidebar-close-button"
            type="button"
            aria-label="Close navigation"
        >
            <span aria-hidden="true">×</span>
        </button>

        <div class="sidebar-logo">
            <img
                class="sidebar-logo-image"
                src="${logoIcon}"
                alt=""
            >
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

    const overlay = document.createElement("button");
    overlay.className = "sidebar-overlay";
    overlay.type = "button";
    overlay.setAttribute("aria-label", "Close navigation");

    return {
        sidebar,
        overlay,
    };
}

export function bindSidebar({
    sidebar,
    overlay,
    trigger,
}: BindSidebarOptions): SidebarController {
    const closeButton = sidebar.querySelector<HTMLButtonElement>(
        ".sidebar-close-button",
    );

    if (!closeButton) {
        throw new Error("Sidebar close button not found.");
    }

    const setOpen = (
        open: boolean,
        restoreFocus = false,
    ): void => {
        sidebar.classList.toggle("open", open);
        overlay.classList.toggle("active", open);
        document.body.classList.toggle("sidebar-open", open);
        trigger.setAttribute("aria-expanded", String(open));
        trigger.setAttribute(
            "aria-label",
            open ? "Close menu" : "Open menu",
        );

        if (open) {
            closeButton.focus();
        } else if (restoreFocus) {
            trigger.focus();
        }
    };

    const close = (restoreFocus = false): void => {
        setOpen(false, restoreFocus);
    };

    trigger.addEventListener("click", () => {
        setOpen(!sidebar.classList.contains("open"), true);
    });
    closeButton.addEventListener("click", () => close(true));
    overlay.addEventListener("click", () => close(true));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && sidebar.classList.contains("open")) {
            event.preventDefault();
            close(true);
        }
    });
    window.addEventListener("resize", () => {
        if (window.innerWidth > 1290) close();
    });

    return { close };
}
