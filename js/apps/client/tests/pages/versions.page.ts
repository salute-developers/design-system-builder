import type { PageReadiness } from '../helpers/page-readiness.ts';
import type { Locator, Page } from '@playwright/test';

/** История публикаций выбирается независимо от версии редактора. */
export class VersionsPage {
    readonly navigationButton: Locator;
    readonly sidebar: Locator;
    readonly content: Locator;
    readonly draftButton: Locator;
    readonly versionInput: Locator;
    readonly notesInput: Locator;
    readonly notesSection: Locator;
    readonly publishButton: Locator;
    readonly emptyMessage: Locator;
    readonly readOnly: Locator;
    readonly editorButton: Locator;
    readonly editorVersionButton: Locator;
    readonly editorDraftOption: Locator;
    readonly editorSettingsButton: Locator;
    readonly editorReady: Locator;
    private readonly page: Page;
    private readonly readiness: PageReadiness;
    private readonly editorURL: string;

    constructor(page: Page, editorURL: string, readiness: PageReadiness) {
        this.page = page;
        this.readiness = readiness;
        this.editorURL = editorURL;
        this.navigationButton = page.getByRole('button', { name: 'Версии дизайн-системы', exact: true });
        this.sidebar = page.getByRole('complementary', { name: 'Версии дизайн-системы', exact: true });
        this.content = page.getByRole('main', { name: 'Состав версии', exact: true });
        this.draftButton = this.sidebar.getByRole('button', { name: 'Черновик публикации', exact: true });
        this.versionInput = this.content.getByRole('textbox', { name: 'Номер версии', exact: true });
        this.notesInput = this.content.getByRole('textbox', { name: 'Описание', exact: true });
        this.notesSection = this.content
            .locator('section')
            .filter({ has: page.getByRole('heading', { name: 'Примечания к версии', exact: true }) });
        this.publishButton = page.getByRole('button', { name: 'Опубликовать версию', exact: true });
        this.emptyMessage = this.content.getByText('Публиковать нечего. Откройте редактор и внесите изменения.', {
            exact: true,
        });
        this.readOnly = page.getByText('Только для чтения', { exact: true });
        this.editorButton = page.getByTestId('editor-nav-colors');
        this.editorVersionButton = page.getByRole('button', { name: 'Версия редактора', exact: true });
        this.editorDraftOption = page.getByRole('option', { name: 'Черновик', exact: true });
        this.editorSettingsButton = page.getByRole('button', { name: 'Настройки темы', exact: true });
        this.editorReady = page.getByRole('main').getByText('Text & Icons', { exact: true });
    }

    async open(): Promise<void> {
        await this.readiness.run('Открытие списка версий', async () => {
            await this.page.goto(this.editorURL);
            await this.navigationButton.click();
            await this.draftButton.waitFor({ state: 'visible' });
        });
    }

    version(number: string): Locator {
        return this.sidebar.getByRole('button').filter({ has: this.page.getByText('v' + number, { exact: true }) });
    }

    change(themeName: string): Locator {
        return this.content.getByRole('button').filter({ hasText: '«' + themeName + '»' });
    }

    publicationMessage(number: string): Locator {
        return this.page.getByText('Версия ' + number + ' создана', { exact: true });
    }
}
