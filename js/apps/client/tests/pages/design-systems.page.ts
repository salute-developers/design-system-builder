import type { Locator, Page } from '@playwright/test';

/** Локаторы каталога и формы проверены на готовом стенде без сетевого перехвата. */
export class DesignSystemsPage {
    readonly createLink: Locator;
    readonly nameInput: Locator;
    readonly createButton: Locator;
    readonly emptyThemes: Locator;
    private readonly page: Page;
    private readonly clientBaseURL: string;
    private readonly projectId: string;
    constructor(page: Page, clientBaseURL: string, projectId: string) {
        this.page = page;
        this.clientBaseURL = clientBaseURL;
        this.projectId = projectId;
        const dialog = page.getByRole('dialog', { name: 'Создать дизайн-систему', exact: true });
        this.createLink = page.getByRole('link', { name: 'Создать дизайн-систему', exact: true });
        this.nameInput = dialog.getByLabel('Название', { exact: true });
        this.createButton = dialog.getByRole('button', { name: 'Создать', exact: true });
        this.emptyThemes = page.getByRole('heading', { name: 'Тем пока нет', exact: true });
    }

    async openCatalog(): Promise<void> {
        await this.page.goto(new URL('projects/' + encodeURIComponent(this.projectId), this.clientBaseURL).href);
    }
    card(name: string): Locator {
        return this.page
            .getByRole('link')
            .filter({ has: this.page.getByRole('heading', { level: 2, name, exact: true }) });
    }
    systemTitle(name: string): Locator {
        return this.page.getByRole('navigation').getByText(name, { exact: true });
    }
    systemURL(id: string): string {
        return new URL(
            `projects/${encodeURIComponent(this.projectId)}/design-systems/${encodeURIComponent(id)}`,
            this.clientBaseURL,
        ).href;
    }
}
