import type { Locator, Page } from '@playwright/test';

/** Прямой URL настроек и отказ Viewer подтверждены исследованием Playwright. */
export class ProjectAccessPage {
    readonly settingsURL: string;
    readonly denied: Locator;
    readonly nameInput: Locator;
    readonly descriptionInput: Locator;
    readonly saveButton: Locator;
    private readonly page: Page;

    constructor(page: Page, clientBaseURL: string, projectId: string) {
        this.page = page;
        this.settingsURL = new URL(`projects/${encodeURIComponent(projectId)}/settings`, clientBaseURL).href;
        const main = page.getByRole('main');
        this.denied = main.getByText('Нет доступа', { exact: true });
        this.nameInput = main.getByRole('textbox', { name: 'Название', exact: true });
        this.descriptionInput = main.getByRole('textbox', { name: 'Описание', exact: true });
        this.saveButton = main.getByRole('button', { name: 'Сохранить', exact: true });
    }

    async openSettings(): Promise<void> {
        await this.page.goto(this.settingsURL);
        await this.denied.waitFor({ state: 'visible' });
    }
}
