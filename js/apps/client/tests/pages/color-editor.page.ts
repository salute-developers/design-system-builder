import type { Locator, Page } from '@playwright/test';
import { colorEditorReadyTimeoutMs } from '../config/timeouts.ts';
import type { PageReadiness } from '../helpers/page-readiness.ts';

/** Цветовой редактор: действия подтверждены на собранном UI через Playwright MCP. */
export class ColorEditorPage {
    readonly inspector: Locator;
    readonly navigationButton: Locator;
    readonly tokenName: Locator;
    readonly light: Locator;
    readonly lightSwatch: Locator;
    readonly manualTab: Locator;
    readonly libraryTab: Locator;
    readonly dark: Locator;
    readonly picker: Locator;
    readonly hex: Locator;
    readonly saving: Locator;
    readonly saved: Locator;
    readonly breadcrumb: Locator;
    private readonly page: Page;
    private readonly readiness: PageReadiness;
    private readonly url: string;

    constructor(page: Page, url: string, readiness: PageReadiness) {
        this.page = page;
        this.url = url;
        this.readiness = readiness;
        this.navigationButton = page
            .getByRole('complementary', { name: 'DS Builder navigation', exact: true })
            .getByRole('button', { name: 'Цветовые токены', exact: true });
        this.inspector = page.locator('.properties-panel');
        this.tokenName = this.inspector.getByRole('button', { name: 'Имя токена', exact: true });
        const defaults = this.inspector
            .locator('section')
            .filter({ has: page.getByRole('heading', { name: 'Темы по умолчанию', exact: true }) });
        this.lightSwatch = defaults.getByRole('button', { name: 'Выбор цвета: Light', exact: true });
        this.light = defaults.getByRole('textbox', { name: 'Light', exact: true });
        this.dark = defaults.getByRole('textbox', { name: 'Dark', exact: true });
        this.picker = page.getByRole('dialog', { name: /^Color picker: /u });
        this.manualTab = this.picker.getByRole('button', { name: 'Вручную', exact: true });
        this.libraryTab = this.picker.getByRole('button', { name: 'Библиотека', exact: true });
        this.hex = this.picker.getByRole('textbox', { name: 'Hex', exact: true });
        this.saving = page.getByRole('status', { name: /^(Ожидает сохранения|Сохраняется)/u });
        this.saved = page.getByRole('status', { name: /^Последнее сохранение — /u });
        this.breadcrumb = page.getByRole('navigation', { name: 'Навигация темы', exact: true });
    }

    token(name: string): Locator {
        return this.page.getByRole('button', { name, exact: true });
    }

    async open(): Promise<void> {
        await this.readiness.run('Открытие цветового редактора', async () => {
            await this.page.goto(this.url);
            await this.tokenName.waitFor({ state: 'visible', timeout: colorEditorReadyTimeoutMs });
        });
    }

    async switchTheme(systemName: string, themeName: string): Promise<void> {
        await this.readiness.run('Переход в тему ' + themeName, async () => {
            await this.breadcrumb.getByRole('link', { name: systemName, exact: true }).click();
            await this.page
                .getByRole('link')
                .filter({ has: this.page.getByText(themeName, { exact: true }) })
                .click();
            await this.navigationButton.click();
            await this.tokenName.waitFor({ state: 'visible', timeout: colorEditorReadyTimeoutMs });
        });
    }

    async reload(): Promise<void> {
        await this.readiness.run('Повторная загрузка цветового редактора', async () => {
            await this.page.reload();
            await this.tokenName.waitFor({ state: 'visible', timeout: colorEditorReadyTimeoutMs });
        });
    }

    async openLight(): Promise<void> {
        await this.lightSwatch.click();
    }

    libraryStep(name: string, step: number, hex: string): Locator {
        return this.picker.getByRole('button', { name: name + ' ' + step + ' ' + hex, exact: true });
    }

    async closePicker(): Promise<void> {
        await this.picker.getByRole('button', { name: 'Закрыть', exact: true }).click();
    }

    async editLight(hex: string): Promise<void> {
        await this.inspector
            .locator('section')
            .filter({ has: this.page.getByRole('heading', { name: 'Темы по умолчанию', exact: true }) })
            .getByRole('button', { name: 'Выбор цвета: Light', exact: true })
            .click();
        await this.picker.getByRole('button', { name: 'Вручную', exact: true }).click();
        await this.hex.fill(hex);
    }

    async confirmLight(): Promise<void> {
        await this.hex.press('Enter');
        await this.page.getByRole('main').getByRole('heading', { name: 'Text & Icons', exact: true }).click();
    }
}
