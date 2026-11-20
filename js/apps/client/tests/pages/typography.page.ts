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

    async selectVariant(variant: 'Regular' | 'Medium' | 'Bold'): Promise<void> {
        await this.page.getByRole('button', { name: 'Начертание', exact: true }).click();
        await this.page.getByRole('option', { name: variant, exact: true }).click();
    }

    weight(variant: 'Regular' | 'Medium' | 'Bold', platform?: 'iOS' | 'Android'): Locator {
        return this.page.getByRole('button', {
            name: `Weight ${variant}${platform ? ' ' + platform : ''}`,
            exact: true,
        });
    }

    overrideRow(field: Locator): Locator {
        return field.locator(
            'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " typography-overridable ")][1]',
        );
    }

    fieldMessage(field: Locator): Locator {
        // RowMessages выводится после общей пары полей, а не внутри одного overridable.
        return this.overrideRow(field).locator('..').locator('xpath=following-sibling::*[1]');
    }

    async addPlatform(field: Locator, platform: 'iOS' | 'Android'): Promise<void> {
        const row = this.overrideRow(field);
        await row.getByRole('button', { name: 'Своё значение платформы', exact: true }).click();
        await row.getByRole('menuitem', { name: platform, exact: true }).click();
    }

    async setWeight(
        variant: 'Regular' | 'Medium' | 'Bold',
        option: string,
        platform?: 'iOS' | 'Android',
    ): Promise<void> {
        await this.weight(variant, platform).click();
        await this.page.getByRole('option', { name: option, exact: true }).click();
    }
}
