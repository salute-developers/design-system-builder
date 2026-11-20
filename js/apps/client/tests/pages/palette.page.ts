import type { Locator, Page } from '@playwright/test';
import type { PageReadiness } from '../helpers/page-readiness.ts';
import type { PaletteSlot } from '../helpers/palette.api.ts';

/** Палитра: точные адреса ступеней, режимы, инспектор и подтверждённый picker. */
export class PalettePage {
    readonly navigationButton: Locator;
    readonly tree: Locator;
    readonly inspector: Locator;
    readonly colorMode: Locator;
    readonly rampMode: Locator;
    readonly allFilter: Locator;
    readonly changedFilter: Locator;
    readonly dialog: Locator;
    readonly hex: Locator;
    readonly applyButton: Locator;
    private readonly page: Page;
    private readonly readiness: PageReadiness;
    private readonly url: string;

    constructor(page: Page, url: string, readiness: PageReadiness) {
        this.page = page;
        this.url = url;
        this.readiness = readiness;
        this.navigationButton = page
            .getByRole('complementary', { name: 'DS Builder navigation', exact: true })
            .getByRole('button', { name: 'Палитра', exact: true });
        this.tree = page.getByRole('complementary', { name: /^(Группы|Цвета) палитры$/u });
        this.inspector = page.locator('.palette-inspector');
        const modes = page.getByRole('tablist', { name: 'Режим редактирования', exact: true });
        this.colorMode = modes.getByRole('tab', { name: 'Цвет', exact: true });
        this.rampMode = modes.getByRole('tab', { name: 'Палитра', exact: true });
        const filters = page.getByRole('tablist', { name: 'Фильтр палитр', exact: true });
        this.allFilter = filters.getByRole('tab', { name: 'Все', exact: true });
        this.changedFilter = filters.getByRole('tab', { name: 'Изменённые', exact: true });
        this.dialog = page.getByRole('dialog', { name: /^Цвет /u });
        this.hex = this.dialog.getByRole('textbox');
        this.applyButton = this.dialog.getByRole('button', { name: 'Применить', exact: true });
    }

    step(groupId: string, slot: PaletteSlot, step: number): Locator {
        return this.page
            .getByRole('tabpanel', { name: 'Цвет', exact: true })
            .locator(`[data-group="${groupId}"][data-slot="${slot.type}.${slot.shade}"][data-step="${step}"]`);
    }

    treeGroup(label: string): Locator {
        return this.tree
            .locator('section')
            .filter({ has: this.page.getByRole('button', { name: label, exact: true }) });
    }

    async open(): Promise<void> {
        await this.readiness.run('Открытие палитры', async () => {
            await this.page.goto(this.url);
            await this.colorMode.waitFor({ state: 'visible' });
        });
    }

    async reload(): Promise<void> {
        await this.readiness.run('Повторная загрузка палитры', async () => {
            await this.page.reload();
            await this.colorMode.waitFor({ state: 'visible' });
        });
    }

    async editSelected(hex: string): Promise<void> {
        await this.inspector.getByRole('button', { name: 'Изменить цвет', exact: true }).click();
        await this.hex.fill(hex);
        await this.hex.press('Tab');
    }
}
