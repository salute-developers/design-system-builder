import type { PageReadiness } from '../helpers/page-readiness.ts';
import type { Locator, Page } from '@playwright/test';

export type CustomPalette = Readonly<{ primary: string; onPrimary: string; background: string; text: string }>;

export class CreateThemePage {
    readonly nameInput: Locator;
    readonly customButton: Locator;
    readonly primaryInput: Locator;
    readonly onPrimaryInput: Locator;
    readonly backgroundInput: Locator;
    readonly textInput: Locator;
    readonly createButton: Locator;
    readonly cancelLink: Locator;
    readonly error: Locator;
    private readonly page: Page;
    private readonly readiness: PageReadiness;

    constructor(page: Page, readiness: PageReadiness) {
        this.page = page;
        this.readiness = readiness;
        const main = page.getByRole('main');
        this.nameInput = main.getByRole('textbox', { name: 'Название', exact: true });
        this.customButton = main.getByRole('button', { name: 'Custom', exact: true });
        this.primaryInput = main.getByRole('textbox', { name: 'Primary', exact: true });
        this.onPrimaryInput = main.getByRole('textbox', { name: 'On primary', exact: true });
        this.backgroundInput = main.getByRole('textbox', { name: 'Background', exact: true });
        this.textInput = main.getByRole('textbox', { name: 'Text', exact: true });
        this.createButton = main.getByRole('button', { name: 'Создать и открыть Theme', exact: true });
        this.cancelLink = main.getByRole('link', { name: 'Отмена', exact: true });
        this.error = main.getByRole('alert');
    }

    async open(systemURL: string): Promise<void> {
        await this.readiness.run('Каталог тем и форма создания', async () => {
            await this.page.goto(systemURL, { timeout: 30_000 });
            await this.page
                .getByRole('main')
                .locator('header')
                .getByRole('link', { name: 'Создать тему', exact: true })
                .click();
            await this.nameInput.waitFor({ state: 'visible' });
        });
    }

    async fillPalette(palette: CustomPalette): Promise<void> {
        await this.primaryInput.fill(palette.primary);
        await this.onPrimaryInput.fill(palette.onPrimary);
        await this.backgroundInput.fill(palette.background);
        await this.textInput.fill(palette.text);
    }
}
