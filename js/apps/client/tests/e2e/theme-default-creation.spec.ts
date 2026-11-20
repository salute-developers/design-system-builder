import { test, expect } from '../fixtures/role-themes.ts';

test.use({ memberRole: 'editor' });

test(
    'PLASMABLDR-T767: PROJ-UI-032 Создание темы по умолчанию и нормализация имени',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T767' } },
    async ({
        page,
        systems,
        createdSystem,
        initialTheme,
        secondTheme,
        colorData,
        themesApi,
        tokenValues,
        createTheme,
        pendingMutation,
        pageReadiness,
    }) => {
        expect(colorData.accent.name).toBe('text.default.accent');
        const baseline = [initialTheme, secondTheme];
        expect(initialTheme.id).not.toBe(secondTheme.id);
        const systemURL = systems.systemURL(createdSystem.id);
        await test.step('Editor открывает форму с Malachite по умолчанию', async () => {
            await pageReadiness.run('Каталог исходных тем и форма создания', async () => {
                await page.goto(systemURL);
                for (const theme of baseline) await expect(systems.card(theme.name)).toBeVisible({ timeout: 30_000 });
                await expect(page.getByRole('main').getByRole('article')).toHaveCount(2);
                await createTheme.openFromCatalog();
            });
            await expect(page.getByRole('button', { name: 'Malachite', exact: true })).toHaveClass(/\bselected\b/u);
            await createTheme.nameInput.fill('  My   Theme  ');
        });
        const themeId = await test.step('Создать одну тему с нормализованным именем', async () => {
            const response = await pendingMutation.run(
                (response) => response.url() === themesApi.createURL && response.request().method() === 'POST',
                () => createTheme.createButton.click(),
                'Создание Malachite',
                15_000,
            );
            expect(response.status()).toBe(201);
            expect(response.request().postDataJSON()).toMatchObject({ name: 'My Theme', profile: 'malachite' });
            const raw: unknown = await response.json();
            expect(raw).toMatchObject({
                id: expect.stringMatching(/\S/u),
                designSystemId: createdSystem.id,
                name: 'My Theme',
                colorConfig: { profile: 'malachite' },
            });
            return (raw as { id: string }).id;
        });
        await test.step('Редактор и Light/Dark инициализированы и сохраняются после reload', async () => {
            const url = systemURL + '/themes/' + encodeURIComponent(themeId) + '/colors';
            const ready = page.getByRole('main').getByRole('heading', { name: 'Text & Icons', exact: true });
            await pageReadiness.run('Редактор созданной Malachite', () =>
                expect(ready).toBeVisible({ timeout: 30_000 }),
            );
            await expect(page).toHaveURL(url);
            await page.reload();
            await pageReadiness.run('Malachite после reload', () => expect(ready).toBeVisible({ timeout: 30_000 }));
            await expect(page).toHaveURL(url);
            const detail = await themesApi.get(themeId);
            expect(detail).toMatchObject({ id: themeId, name: 'My Theme', colorConfig: { profile: 'malachite' } });
            const colors = (await tokenValues.values(themeId, 'color')).filter(
                (value) => value.tokenId === colorData.accent.id && value.platform === 'web',
            );
            expect(colors.map((value) => value.mode).sort()).toEqual(['dark', 'light']);
            // Стандартный профиль хранит одноэлементный массив; CT-BASE отдельно сохраняет строку HEX.
            for (const value of colors) expect(value.value).toEqual([expect.stringMatching(/^#[0-9A-F]{6,8}$/iu)]);
            expect(new URL(page.url()).searchParams.has('versionId')).toBe(false);
            expect(detail).not.toHaveProperty('versionId');
        });
        await test.step('В списке появилась только одна новая тема My Theme', async () => {
            const expectedURL = new URL(themesApi.listURL);
            const [response] = await Promise.all([
                page.waitForResponse(
                    (response) => {
                        const actual = new URL(response.url());
                        return (
                            response.request().method() === 'GET' &&
                            actual.origin === expectedURL.origin &&
                            actual.pathname === expectedURL.pathname
                        );
                    },
                    { timeout: 30_000 },
                ),
                page
                    .getByRole('navigation', { name: 'Навигация темы', exact: true })
                    .getByRole('link', { name: createdSystem.name, exact: true })
                    .click(),
            ]);
            expect(response.status(), 'Каталог загрузил список тем успешно').toBe(200);
            const after: unknown = await response.json();
            expect(after).toHaveLength(3);
            expect(after).toEqual(
                expect.arrayContaining([
                    ...baseline.map((theme) => expect.objectContaining(theme)),
                    expect.objectContaining({ id: themeId, designSystemId: createdSystem.id, name: 'My Theme' }),
                ]),
            );
            await expect(systems.card('My Theme')).toHaveCount(1);
            for (const theme of baseline) await expect(systems.card(theme.name)).toHaveCount(1);
        });
    },
);
