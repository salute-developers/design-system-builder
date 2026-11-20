import type { Response } from '@playwright/test';
import { expect, test } from '../fixtures/themes.ts';

const palette = { primary: '#3366CC', onPrimary: '#FFFFFF', background: '#F5F5F5', text: '#171717' };

function isApiResponse(response: Response, expectedURL: string, method: 'GET' | 'POST'): boolean {
    const actual = new URL(response.url());
    const expected = new URL(expectedURL);
    return (
        response.request().method() === method &&
        actual.origin === expected.origin &&
        actual.pathname === expected.pathname
    );
}

test(
    'PLASMABLDR-T768: PROJ-UI-033 Custom: ошибки HEX и исправление формы',
    { tag: '@smoke', annotation: { type: 'zephyr', description: 'PLASMABLDR-T768' } },
    async ({
        page,
        systems,
        createdSystem,
        createTheme,
        themesApi,
        themeCreations,
        pendingMutation,
        pageReadiness,
    }) => {
        await test.step('Проверить невалидные HEX, восстановление формы и отмену', async () => {
            await createTheme.open(systems.systemURL(createdSystem.id));
            await createTheme.customButton.click();
            await createTheme.nameInput.fill('QA Invalid HEX');
            await createTheme.fillPalette(palette);
            await expect(createTheme.createButton).toBeEnabled();
            for (const value of ['#12345', '#GGHHII', '']) {
                await test.step('Отклонить Primary=' + JSON.stringify(value), async () => {
                    await createTheme.primaryInput.fill(value);
                    await createTheme.primaryInput.press('Tab');
                    await expect(createTheme.error).toHaveText('Введите цвета в формате #RRGGBB.');
                    await expect(createTheme.createButton).toBeDisabled();
                    expect(themeCreations(), 'Блокировка формы не отправляет POST').toBe(0);
                });
            }
            await createTheme.primaryInput.fill(palette.primary);
            await expect(createTheme.error).toHaveCount(0);
            await expect(createTheme.createButton).toBeEnabled();
            await createTheme.cancelLink.click();
            await page.reload();
            await expect(systems.emptyThemes).toBeVisible();
            expect(await themesApi.list()).toEqual([]);
            expect(themeCreations()).toBe(0);
        });

        const name = 'QA Custom Theme';
        const systemURL = systems.systemURL(createdSystem.id);
        const expected = {
            designSystemId: createdSystem.id,
            name,
            colorConfig: { profile: 'custom', customPalette: palette },
        };

        await test.step('Заполнить Custom и проверить HEX в полях', async () => {
            await createTheme.open(systemURL);
            await createTheme.customButton.click();
            await createTheme.fillPalette(palette);
            await createTheme.nameInput.fill(name);
            await expect(createTheme.error).toHaveCount(0);
            await expect(createTheme.createButton).toBeEnabled();
            for (const [field, hex] of [
                [createTheme.primaryInput, palette.primary],
                [createTheme.onPrimaryInput, palette.onPrimary],
                [createTheme.backgroundInput, palette.background],
                [createTheme.textInput, palette.text],
            ] as const) {
                await expect(field).toBeVisible();
                await expect(field).toHaveValue(hex);
            }
        });

        const themeId = await test.step('Создать тему через UI с реальным POST 201', async () => {
            const response = await pendingMutation.run(
                (response) => isApiResponse(response, themesApi.createURL, 'POST'),
                () => createTheme.createButton.click(),
                'Создание темы',
            );
            expect(response.status()).toBe(201);
            expect(response.request().postDataJSON()).toEqual({
                designSystemId: createdSystem.id,
                name,
                profile: 'custom',
                customPalette: palette,
            });
            const raw: unknown = await response.json();
            expect(raw).toMatchObject({ ...expected, id: expect.stringMatching(/\S/u) });
            return (raw as { id: string }).id;
        });

        await test.step('Редактор и независимые чтения после reload подтверждают сохранение', async () => {
            const editorURL = systemURL + '/themes/' + encodeURIComponent(themeId) + '/colors';
            const editorReady = page.getByRole('main').getByText('Text & Icons', { exact: true });
            await pageReadiness.run('Загрузка редактора после создания Theme', () =>
                expect(editorReady, 'Тема загрузилась, редактор цветов готов').toBeVisible({ timeout: 30_000 }),
            );
            await expect(page).toHaveURL(editorURL);
            await expect(
                page.getByRole('navigation', { name: 'Навигация темы' }).getByText(name, { exact: true }),
            ).toBeVisible();
            expect(await themesApi.get(themeId)).toMatchObject({ ...expected, id: themeId });
            const observed = page.waitForResponse((response) =>
                isApiResponse(response, themesApi.detailURL(themeId), 'GET'),
            );
            const [response] = await Promise.all([observed, page.reload()]);
            expect(response.status()).toBe(200);
            expect(
                new URL(response.url()).searchParams.has('versionId'),
                'После reload читается активный черновик, а не опубликованная версия',
            ).toBe(false);
            expect(await response.json()).toMatchObject({ ...expected, id: themeId });
            await pageReadiness.run('Загрузка редактора после reload', () =>
                expect(editorReady, 'После reload редактор цветов готов').toBeVisible({ timeout: 30_000 }),
            );
            await expect(page).toHaveURL(editorURL);
            expect(await themesApi.list()).toEqual([{ id: themeId, designSystemId: createdSystem.id, name }]);
        });
    },
);

test(
    'PLASMABLDR-T555: PROJ-UI-037 Theme: duplicate Name без учёта регистра',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T555' } },
    async ({ page, systems, createdSystem, createTheme, themesApi, initialTheme, pendingMutation }) => {
        const systemURL = systems.systemURL(createdSystem.id);
        await createTheme.open(systemURL);
        await createTheme.nameInput.fill('theme a');
        const response = await pendingMutation.run(
            (response) => isApiResponse(response, themesApi.createURL, 'POST'),
            () => createTheme.createButton.click(),
            'Проверка дубликата темы',
        );
        expect(response.status()).toBe(409);
        expect(await response.json()).toMatchObject({ code: 'TENANT_NAME_CONFLICT' });
        await expect(createTheme.error).toHaveText('Theme с таким названием уже существует.');
        await expect(page).toHaveURL(systemURL + '/themes/new');
        await createTheme.cancelLink.click();
        await page.reload();
        await expect(systems.card(initialTheme.name)).toBeVisible();
        await expect(systems.card('theme a')).toHaveCount(0);
        expect(await themesApi.list(), 'Исходная тема сохранилась без дубликата').toEqual([initialTheme]);
    },
);
