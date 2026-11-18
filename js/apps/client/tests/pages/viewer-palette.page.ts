import type { Locator, Page } from '@playwright/test';
import type { PageReadiness } from '../helpers/page-readiness.ts';
import { PalettePage } from './palette.page.ts';

export class ViewerPalettePage extends PalettePage {
    readonly readOnly: Locator;
    readonly region: Locator;
    readonly linkedAccent: Locator;
    readonly allLinks: Locator;
    readonly searchButton: Locator;
    readonly search: Locator;
    readonly closeSearchButton: Locator;
    readonly mutationControls: Locator;

    constructor(page: Page, url: string, readiness: PageReadiness) {
        super(page, url, readiness);
        this.region = page.getByRole('region', { name: 'Палитра', exact: true });
        this.readOnly = this.inspector.getByText('Только просмотр', { exact: true });
        this.linkedAccent = this.inspector.getByRole('button', { name: 'textAccent Открыть', exact: true });
        this.allLinks = this.inspector.getByRole('tab', { name: /^Все \d+$/u });
        this.searchButton = this.tree.getByRole('button', { name: 'Поиск', exact: true });
        this.search = this.tree.getByRole('textbox', { name: 'Найти цвет или палитру', exact: true });
        this.closeSearchButton = this.tree.getByRole('button', { name: 'Закрыть поиск', exact: true });
        this.mutationControls = this.region.getByRole('button', {
            name: /\+|Создать группу|Добавить палитру|Удалить группу|Переименовать|Убрать .* из группы|Применить|Заменить|Поменять|Изменить/u,
        });
    }

    greenRamp(groupLabel: string): Locator {
        return this.region
            .getByRole('button', { name: `Редактировать палитру Green в группе ${groupLabel}`, exact: true })
            .filter({ hasText: 'Hue130' });
    }
}
