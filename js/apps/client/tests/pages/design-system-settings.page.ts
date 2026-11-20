import type { Locator, Page } from '@playwright/test';

/** Локаторы переименования подтверждены на стенде через Playwright MCP. */
export class DesignSystemSettingsPage {
    readonly openLink: Locator;
    readonly nameInput: Locator;
    readonly saveButton: Locator;
    readonly savedMessage: Locator;

    constructor(page: Page) {
        const main = page.getByRole('main');
        this.openLink = main.getByRole('link', { name: 'Настройки дизайн-системы', exact: true });
        this.nameInput = main.getByRole('textbox', { name: 'Название', exact: true });
        this.saveButton = main.getByRole('button', { name: 'Сохранить', exact: true });
        this.savedMessage = main.getByText('Сохранено', { exact: true });
    }
}
