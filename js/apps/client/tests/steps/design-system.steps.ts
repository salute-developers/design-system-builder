import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { designSystem } from '../helpers/design-system.api.ts';
import type { DesignSystemApi, DesignSystem } from '../helpers/design-system.api.ts';
import type { SystemTestData } from '../helpers/test-data.ts';
import type { DesignSystemsPage } from '../pages/design-systems.page.ts';

export class DesignSystemSteps {
    private readonly page: Page;
    private readonly systems: DesignSystemsPage;
    private readonly api: DesignSystemApi;
    private readonly data: SystemTestData;
    constructor(page: Page, systems: DesignSystemsPage, api: DesignSystemApi, data: SystemTestData) {
        this.page = page;
        this.systems = systems;
        this.api = api;
        this.data = data;
    }

    create(): Promise<DesignSystem> {
        return test.step('Owner создаёт дизайн-систему через UI', async () => {
            await this.systems.openCatalog();
            await this.systems.createLink.click();
            await this.systems.nameInput.fill(this.data.name);
            const observed = this.page
                .waitForResponse(
                    (response) => response.url() === this.api.url() && response.request().method() === 'POST',
                    { timeout: 15000 },
                )
                .then(async (response) => {
                    expect(response.status(), 'Создание системы должно вернуть HTTP 201').toBe(201);
                    const raw: unknown = await response.json();
                    this.data.register(raw); // Подтверждённый ID сохраняется до полной проверки DTO.
                    const system = designSystem(raw);
                    expect(system.isTechnical, 'UI должен создать обычную систему').toBe(false);
                    return system;
                });
            this.data.creationAttempted();
            // Оба Promise завершаются до teardown, даже если нажатие и ответ расходятся по времени.
            const [creation, action] = await Promise.allSettled([observed, this.systems.createButton.click()]);
            if (creation.status === 'rejected') {
                if (action.status === 'rejected')
                    throw new AggregateError(
                        [action.reason, creation.reason],
                        'Не удалось завершить UI-создание системы.',
                        { cause: action.reason },
                    );
                throw creation.reason;
            }
            if (action.status === 'rejected') throw action.reason;
            return creation.value;
        });
    }
    reload(id: string): Promise<DesignSystem> {
        return test.step('Полная перезагрузка получает свежий GET системы', async () => {
            const observed = this.page.waitForResponse(
                (response) =>
                    response.url() === this.api.url('/' + encodeURIComponent(id)) &&
                    response.request().method() === 'GET',
                { timeout: 15000 },
            );
            const [response] = await Promise.all([observed, this.page.reload()]);
            expect(response.status()).toBe(200);
            expect(response.fromServiceWorker()).toBe(false);
            return designSystem(await response.json());
        });
    }
    reopen(name: string): Promise<void> {
        return test.step('Owner повторно открывает систему из каталога', async () => {
            await this.systems.openCatalog();
            await this.systems.card(name).click();
        });
    }
}
