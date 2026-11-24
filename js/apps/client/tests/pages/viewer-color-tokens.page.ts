import type { Locator, Page } from '@playwright/test';
import { ViewerColorsPage } from './viewer-colors.page.ts';

/** Дополнительные ограничения редактора цветов Viewer; взаимодействия проверены через Playwright. */
export class ViewerColorTokensPage extends ViewerColorsPage {
    readonly inspector: Locator;
    readonly tree: Locator;
    readonly rows: Locator;
    readonly subthemes: Locator;
    readonly contextLinks: Locator;
    readonly platformControls: Locator;
    readonly treeMutationControls: Locator;
    readonly nameEditor: Locator;
    readonly accentTile: Locator;
    readonly picker: Locator;

    constructor(page: Page) {
        super(page);
        this.inspector = page.locator('.properties-panel');
        this.tree = page.getByRole('complementary').filter({
            has: page.getByRole('button', { name: 'Порядок токенов', exact: true }),
        });
        this.rows = this.tree.locator('button[data-testid^="color-token-row-"]');
        this.subthemes = this.inspector.locator('section').filter({
            has: page.getByRole('heading', { name: /^Подтемы/u }),
        });
        this.contextLinks = this.subthemes.getByRole('button', { name: 'Связь с Modes включена', exact: true });
        this.platformControls = this.inspector.getByRole('button', {
            name: /^(Своё значение платформы:|Добавить значение|Удалить значение)/u,
        });
        this.treeMutationControls = this.tree.getByRole('button', {
            name: /^(Добавить|Создать|Удалить|Переименовать)(?: |$)/u,
        });
        this.nameEditor = this.inspector.getByRole('button', { name: 'Имя токена', exact: true });
        this.accentTile = page.locator('main.preview-canvas').getByTitle(/^textAccent - Light /u);
        this.picker = page.getByRole('dialog', { name: /^Color picker:/u });
    }

    token(name: string): Locator {
        return this.tree.getByRole('button', { name, exact: true });
    }
}
