import type { Locator, Page } from '@playwright/test';

/** Каталог и окно создания проекта; локаторы подтверждены Playwright MCP. */
export class ProjectsPage {
    readonly createLink: Locator;
    readonly dialog: Locator;
    readonly nameInput: Locator;
    readonly descriptionInput: Locator;
    readonly nextButton: Locator;
    readonly cancelLink: Locator;
    readonly memberSearch: Locator;
    readonly roleButton: Locator;
    readonly backButton: Locator;
    readonly submitButton: Locator;
    readonly catalogURL: string;
    private readonly page: Page;

    constructor(page: Page, catalogURL: string) {
        this.page = page;
        this.catalogURL = catalogURL;
        const main = page.getByRole('main');
        this.createLink = main.locator('header').getByRole('link', { name: 'Создать проект', exact: true });
        this.dialog = page.getByRole('dialog', { name: 'Создать проект', exact: true });
        this.nameInput = this.dialog.getByRole('textbox', { name: 'Название', exact: true });
        this.descriptionInput = this.dialog.getByRole('textbox', { name: 'Описание', exact: true });
        this.nextButton = this.dialog.getByRole('button', { name: 'Далее', exact: true });
        this.cancelLink = this.dialog.getByRole('link', { name: 'Отмена', exact: true });
        this.memberSearch = this.dialog.getByRole('searchbox', { name: 'Участник', exact: true });
        this.roleButton = this.dialog.getByRole('button', { name: 'Роль', exact: true });
        this.backButton = this.dialog.getByRole('button', { name: 'Назад', exact: true });
        this.submitButton = this.dialog.getByRole('button', { name: 'Создать проект', exact: true });
    }

    async openCreateDialog(): Promise<void> {
        await this.page.goto(this.catalogURL);
        await this.createLink.click();
        await this.nameInput.waitFor({ state: 'visible' });
    }

    card(name: string): Locator {
        return this.page
            .getByRole('main')
            .getByRole('link')
            .filter({
                has: this.page.getByRole('heading', { name, level: 2, exact: true }),
            });
    }
}
