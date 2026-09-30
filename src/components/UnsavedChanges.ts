export interface PageChangeGuard {
    readonly hasUnsavedChanges: () => boolean;
    readonly confirmLeave: (trigger?: HTMLElement | null) => Promise<boolean>;
}

export function formValueSignature(form: HTMLFormElement | null): string {
    if (!form) return "";

    return JSON.stringify(Array.from(form.elements)
        .filter((element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement)
        .filter((element) => element.name.length > 0)
        .map((element) => [
            element.name,
            element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")
                ? element.checked
                : element.value,
        ]));
}

export function confirmDiscardUnsavedChanges(
    pageName: string,
    trigger?: HTMLElement | null,
): Promise<boolean> {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "unsaved-changes-dialog";
        dialog.setAttribute("aria-labelledby", "unsaved-changes-title");
        dialog.innerHTML = `
            <h2 id="unsaved-changes-title">Unsaved changes</h2>
            <p>You have unsaved ${pageName} changes. If you leave now, those changes will be lost.</p>
            <div class="unsaved-changes-actions">
                <button type="button" class="secondary-button" data-keep-editing>Keep editing</button>
                <button type="button" class="danger-button" data-discard-changes>Discard changes</button>
            </div>
        `;
        document.body.append(dialog);

        let settled = false;
        const finish = (discard: boolean): void => {
            if (settled) return;
            settled = true;
            dialog.close();
            dialog.remove();
            if (!discard) trigger?.focus();
            resolve(discard);
        };

        dialog.querySelector("[data-keep-editing]")?.addEventListener("click", () => finish(false));
        dialog.querySelector("[data-discard-changes]")?.addEventListener("click", () => finish(true));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            finish(false);
        });
        dialog.addEventListener("close", () => {
            if (!settled) finish(false);
        });
        dialog.showModal();
    });
}
