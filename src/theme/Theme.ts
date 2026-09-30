export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "pricepocket-theme";
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function initializeTheme(): void {
    applyTheme(readThemePreference());

    window.matchMedia(COLOR_SCHEME_QUERY).addEventListener("change", () => {
        if (readThemePreference() === "system") {
            applyTheme("system");
        }
    });
}

export function getThemePreference(): ThemePreference {
    return readThemePreference();
}

export function setThemePreference(preference: ThemePreference): void {
    window.localStorage.setItem(STORAGE_KEY, preference);
    applyTheme(preference);
}

function applyTheme(preference: ThemePreference): void {
    const resolvedTheme = preference === "system"
        ? window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light"
        : preference;

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
}

function readThemePreference(): ThemePreference {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
}
