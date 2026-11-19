import type { Locator, Page } from '@playwright/test';
import type { PageReadiness } from '../helpers/page-readiness.ts';
import { SizesPage } from './sizes.page.ts';

/** Только дополнения для Viewer; общие переходы и локаторы остаются в SizesPage. */
export class ViewerSizesPage extends SizesPage {
    readonly tree: Locator;
    readonly board: Locator;
    readonly inspector: Locator;
    readonly opacity: Locator;
    readonly colorPicker: Locator;
    readonly layers: Locator;
    readonly mutationControls: Locator;

    constructor(page: Page, url: string, readiness: PageReadiness) {
        super(page, url, readiness);
        this.tree = this.screen.getByRole('complementary').first();
        this.board = this.screen.getByRole('main');
        this.inspector = this.screen.getByRole('complementary').last();
        this.opacity = this.inspector.getByRole('textbox', { name: 'Веб, слой 1, прозрачность', exact: true });
        this.colorPicker = this.inspector.getByRole('button', { name: 'Веб, слой 1, выбор цвета', exact: true });
        this.layers = this.inspector.getByTestId(/^layers-\d+$/u);
        this.mutationControls = this.screen.getByRole('button', {
            name: /Добавить токен|Удалить токен|Добавить слой|Удалить слой|Своё значение платформы|Свои слои платформы|Убрать сво[иё]/u,
        });
    }

    async selectRadius(tokenId: string): Promise<void> {
        const toggle = this.screen
            .getByTestId('size-section-radius')
            .getByRole('button', { name: 'Радиусы', exact: true });
        if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
        await this.row(tokenId).click();
    }
}
