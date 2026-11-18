import { colorEditorReadyTimeoutMs } from '../config/timeouts.ts';
import type { Locator, Page } from '@playwright/test';

/** Экраны, Body M и числовые поля подтверждены исследованием Playwright. */
export class TypographyPage {
    readonly size: Locator;
    readonly lineHeight: Locator;
    readonly letterSpacing: Locator;
    readonly bodyM: Locator;
    readonly sample: Locator;
    readonly saved: Locator;
    private readonly page: Page;

    constructor(page: Page) {
        this.page = page;
        const inspector = page.locator('.typography-inspector');
        this.size = inspector.getByRole('textbox', { name: 'Size', exact: true });
        this.lineHeight = inspector.getByRole('textbox', { name: 'Line Height', exact: true });
        this.letterSpacing = inspector.getByRole('textbox', { name: 'Letter Spacing', exact: true });
        this.bodyM = page.getByRole('main').getByRole('button', { name: /^Body M, /u });
        this.sample = this.bodyM.locator('[data-preview]');
        this.saved = page.getByRole('status', { name: /^Последнее сохранение — /u });
    }

    async selectScreen(label: string): Promise<void> {
        const tab = this.page.getByRole('tab', { name: label, exact: true });
        await tab.waitFor({ state: 'visible', timeout: colorEditorReadyTimeoutMs });
        await tab.click();
        await this.bodyM.click();
        await this.size.waitFor({ state: 'visible' });
    }
}
