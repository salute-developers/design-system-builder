import type { PageReadiness } from '../helpers/page-readiness.ts';
import type { Locator, Page } from '@playwright/test';

/** Экран журнала; навигация и пустое состояние подтверждены Playwright MCP. */
export class JournalPage {
    readonly navigationButton: Locator;
    readonly list: Locator;
    readonly emptyHeading: Locator;
    readonly emptyDescription: Locator;
    private readonly page: Page;
    private readonly readiness: PageReadiness;
    private readonly editorURL: string;

    constructor(page: Page, editorURL: string, readiness: PageReadiness) {
        this.page = page;
        this.readiness = readiness;
        this.editorURL = editorURL;
        this.navigationButton = page.getByRole('button', { name: 'Изменения дизайн-системы', exact: true });
        this.list = page.getByRole('main', { name: 'Список изменений', exact: true });
        this.emptyHeading = this.list.getByRole('heading', { name: 'Изменений пока нет', exact: true });
        this.emptyDescription = this.list.getByText(
            'Неопубликованных изменений нет. Вернитесь в редактор, чтобы изменить дизайн-систему.',
            { exact: true },
        );
    }

    async open(): Promise<void> {
        await this.readiness.run('Открытие журнала', async () => {
            await this.page.goto(this.editorURL);
            await this.navigationButton.click();
            await this.list.waitFor({ state: 'visible' });
        });
    }
}
