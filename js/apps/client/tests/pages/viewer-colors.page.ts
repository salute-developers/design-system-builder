import { colorEditorReadyTimeoutMs } from '../config/timeouts.ts';
import type { Locator, Page } from '@playwright/test';

/** Read-only инспектор подтверждён исследованием настоящей Viewer-сессии. */
export class ViewerColorsPage {
    readonly readOnly: Locator;
    readonly light: Locator;
    readonly dark: Locator;
    readonly lightPicker: Locator;
    readonly darkPicker: Locator;
    private readonly page: Page;

    constructor(page: Page) {
        this.page = page;
        const inspector = page.locator('.properties-panel');
        this.readOnly = inspector.getByText('Только просмотр', { exact: true });
        const defaults = inspector.locator('section').filter({
            has: page.getByRole('heading', { name: 'Темы по умолчанию', exact: true }),
        });
        this.light = defaults.getByRole('textbox', { name: 'Light', exact: true });
        this.dark = defaults.getByRole('textbox', { name: 'Dark', exact: true });
        this.lightPicker = defaults.getByRole('button', { name: 'Выбор цвета: Light', exact: true });
        this.darkPicker = defaults.getByRole('button', { name: 'Выбор цвета: Dark', exact: true });
    }

    async selectAccent(): Promise<void> {
        const accent = this.page.getByRole('button', { name: 'textAccent', exact: true });
        await accent.waitFor({ state: 'visible', timeout: colorEditorReadyTimeoutMs });
        await accent.click();
        await this.readOnly.waitFor({ state: 'visible' });
    }
}
