import { sectionReadyTimeoutMs } from '../config/timeouts.ts';
import type { Locator, Page } from '@playwright/test';
import type { PageReadiness } from '../helpers/page-readiness.ts';

/** Каталог и меню темы подтверждены исследованием реальной Editor-сессии. */
export class ThemeCatalogPage {
    readonly menu: Locator;
    private readonly page: Page;
    private readonly readiness: PageReadiness;

    constructor(page: Page, readiness: PageReadiness) {
        this.page = page;
        this.readiness = readiness;
        this.menu = page.getByRole('menu');
    }

    card(name: string): Locator {
        return this.page.getByRole('article').filter({
            has: this.page.getByRole('heading', { level: 2, name, exact: true }),
        });
    }

    async openFromEditor(systemName: string, themeName: string): Promise<void> {
        await this.readiness.run('Возврат из редактора в каталог тем', async () => {
            await this.page
                .getByRole('navigation', { name: 'Навигация темы', exact: true })
                .getByRole('link', { name: systemName, exact: true })
                .click();
            await this.readiness.waitFor('Загрузка карточки темы', this.card(themeName), {
                timeout: sectionReadyTimeoutMs,
            });
        });
    }

    async openActions(themeName: string): Promise<void> {
        await this.card(themeName)
            .getByRole('button', { name: 'Действия: ' + themeName, exact: true })
            .click();
        await this.readiness.waitFor('Меню действий темы', this.menu, { timeout: sectionReadyTimeoutMs });
    }
}
