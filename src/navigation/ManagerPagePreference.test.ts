import { describe, expect, it } from "vitest";
import {
    DEFAULT_MANAGER_PAGE,
    MANAGER_PAGE_STORAGE_KEY,
    readManagerPagePreference,
    writeManagerPagePreference,
} from "./ManagerPagePreference";

function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
        values,
    };
}

describe("manager page preference", () => {
    it("restores a recognized manager page", () => {
        const storage = memoryStorage({ [MANAGER_PAGE_STORAGE_KEY]: "settings" });
        expect(readManagerPagePreference(storage)).toBe("settings");
    });

    it("falls back to Schedule for missing, invalid, or unavailable storage", () => {
        expect(readManagerPagePreference(memoryStorage())).toBe(DEFAULT_MANAGER_PAGE);
        expect(readManagerPagePreference(memoryStorage({
            [MANAGER_PAGE_STORAGE_KEY]: "unknown",
        }))).toBe(DEFAULT_MANAGER_PAGE);
        expect(readManagerPagePreference({
            getItem: () => { throw new Error("unavailable"); },
            setItem: () => undefined,
        })).toBe(DEFAULT_MANAGER_PAGE);
    });

    it("stores the confirmed manager page selection", () => {
        const storage = memoryStorage();
        writeManagerPagePreference(storage, "planner");
        expect(storage.values.get(MANAGER_PAGE_STORAGE_KEY)).toBe("planner");
    });
});
