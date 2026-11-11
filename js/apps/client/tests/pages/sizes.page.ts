import type { Locator, Page } from '@playwright/test';
import type { PageReadiness } from '../helpers/page-readiness.ts';

const sectionLabels = { spacing: 'Отступы', shadow: 'Тени' } as const;
type SizeSection = keyof typeof sectionLabels;

export class SizesPage {
    readonly navigationButton: Locator;
    readonly screen: Locator;
    readonly value: Locator;
    readonly saveStatus: Locator;
    readonly viewer: Locator;
    private readonly url: string;
    private readonly page: Page;
    private readonly readiness: PageReadiness;

    constructor(page: Page, url: string, readiness: PageReadiness) {
        this.page = page;
        this.url = url;
        this.readiness = readiness;
        this.navigationButton = page.getByRole('button', { name: 'Отступы, радиусы и тени', exact: true });
        this.screen = page.getByTestId('size-tokens-screen');
        this.value = this.screen.getByRole('textbox', { name: 'Значение, px', exact: true });
        this.saveStatus = this.screen.getByTestId('size-tokens-save-status');
        this.viewer = this.screen.getByTestId('size-tokens-viewer');
    }

    row(tokenId: string): Locator {
        return this.screen.locator(`button[data-token-id="${tokenId}"]`);
    }

    tile(name: string): Locator {
        return this.screen.getByRole('button', { name, exact: true });
    }

    layerField(field: 'X' | 'Y' | 'Blur' | 'Spread' | 'HEX'): Locator {
        return this.screen.getByRole('textbox', { name: 'Веб, слой 1, ' + field, exact: true });
    }

    shadowPreview(name: string): Locator {
        return this.screen
            .getByTestId('shadow-grid')
            .getByRole('button', { name, exact: true })
            .locator('.st-shadow-preview b');
    }

    async select(section: SizeSection, tokenId: string): Promise<void> {
        const toggle = this.screen
            .getByTestId('size-section-' + section)
            .getByRole('button', { name: sectionLabels[section], exact: true });
        if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
        await this.row(tokenId).click();
    }

    async open(): Promise<void> {
        await this.readiness.run('Открытие редактора размеров', async () => {
            await this.page.goto(this.url);
            await this.screen.waitFor({ state: 'visible' });
        });
    }

    async reload(): Promise<void> {
        await this.readiness.run('Повторная загрузка редактора размеров', async () => {
            await this.page.reload();
            await this.screen.waitFor({ state: 'visible' });
        });
    }
}
