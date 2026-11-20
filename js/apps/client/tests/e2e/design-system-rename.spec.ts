import { expect, test } from '../fixtures/design-system.ts';

test(
    'PLASMABLDR-T547: PROJ-UI-029 Design System: Rename сохраняет designSystemId',
    { tag: '@smoke', annotation: { type: 'zephyr', description: 'PLASMABLDR-T547' } },
    async ({ page, systems, systemsApi, createdSystem, systemSettings, pendingMutation }) => {
        const renamedName = 'renamed-' + createdSystem.name;
        const systemURL = systems.systemURL(createdSystem.id);
        const apiURL = systemsApi.url('/' + encodeURIComponent(createdSystem.id));
        const expected = { id: createdSystem.id, name: renamedName, projectId: createdSystem.projectId };
        const originalIds = (await systemsApi.list()).map((system) => system.id).sort();
        expect(originalIds, 'Подготовленная ДС присутствует в каталоге').toContain(createdSystem.id);

        await test.step('Открыть настройки подготовленной ДС', async () => {
            await page.goto(systemURL);
            await expect(systems.emptyThemes).toBeVisible();
            await systemSettings.openLink.click();
            await expect(systemSettings.nameInput).toHaveValue(createdSystem.name);
        });

        await test.step('Переименовать ДС через UI', async () => {
            await systemSettings.nameInput.fill(renamedName);
            const endpoint = new URL(apiURL);
            const response = await pendingMutation.run(
                (response) => {
                    const actual = new URL(response.url());
                    return (
                        response.request().method() === 'PATCH' &&
                        actual.origin === endpoint.origin &&
                        actual.pathname === endpoint.pathname
                    );
                },
                () => systemSettings.saveButton.click(),
                'Переименование ДС',
            );
            expect(response.status(), 'Переименование подтверждено сервером').toBe(200);
            expect(response.request().postDataJSON()).toEqual({ name: renamedName });
            expect(await response.json()).toMatchObject(expected);
            await expect(systemSettings.savedMessage).toBeVisible();
        });

        await test.step('Независимый GET и reload подтверждают имя и прежний ID', async () => {
            expect(await systemsApi.get(createdSystem.id)).toMatchObject(expected);
            const observed = page.waitForResponse(
                (response) => response.url() === apiURL && response.request().method() === 'GET',
            );
            const [response] = await Promise.all([observed, page.reload()]);
            expect(response.status()).toBe(200);
            expect(response.fromServiceWorker()).toBe(false);
            expect(await response.json()).toMatchObject(expected);
            await expect(page).toHaveURL(systemURL + '/settings');
            await expect(systemSettings.nameInput).toHaveValue(renamedName);
        });

        await test.step('В каталоге обновлена та же ДС, новая не появилась', async () => {
            await systems.openCatalog();
            await expect(systems.card(renamedName)).toHaveCount(1);
            await expect(systems.card(renamedName)).toHaveAttribute('href', new URL(systemURL).pathname);
            await expect(systems.card(createdSystem.name)).toHaveCount(0);
            expect((await systemsApi.list()).map((system) => system.id).sort()).toEqual(originalIds);
            await systems.card(renamedName).click();
            await expect(page).toHaveURL(systemURL);
            await expect(systems.systemTitle(renamedName)).toBeVisible();
            await expect(systems.emptyThemes).toBeVisible();
        });
    },
);
