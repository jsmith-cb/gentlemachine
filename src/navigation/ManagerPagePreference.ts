export type ManagerPage = "schedule" | "planner" | "team" | "settings";

export const DEFAULT_MANAGER_PAGE: ManagerPage = "schedule";
export const MANAGER_PAGE_STORAGE_KEY = "pp-crew-manager-page";

interface PagePreferenceStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export function isManagerPage(value: unknown): value is ManagerPage {
    return value === "schedule" || value === "planner" ||
        value === "team" || value === "settings";
}

export function readManagerPagePreference(
    storage: PagePreferenceStorage,
): ManagerPage {
    try {
        const value = storage.getItem(MANAGER_PAGE_STORAGE_KEY);
        return isManagerPage(value) ? value : DEFAULT_MANAGER_PAGE;
    } catch {
        return DEFAULT_MANAGER_PAGE;
    }
}

export function writeManagerPagePreference(
    storage: PagePreferenceStorage,
    page: ManagerPage,
): void {
    try {
        storage.setItem(MANAGER_PAGE_STORAGE_KEY, page);
    } catch {
        // Page selection is presentation state. Storage failure must not block navigation.
    }
}
