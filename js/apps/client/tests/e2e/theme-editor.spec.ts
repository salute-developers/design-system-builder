import type { Request } from '@playwright/test';
import { test as base, expect } from '../fixtures/role-themes.ts';
import { exactValue } from '../helpers/color-data.ts';
import { ThemeCatalogPage } from '../pages/theme-catalog.page.ts';

const test = base.extend<{ themeCatalog: ThemeCatalogPage }>({
    themeCatalog: async ({ page, pageReadiness }, use) => {
        await use(new ThemeCatalogPage(page, pageReadiness));
    },
});

test.use({ memberRole: 'editor' });

test(
    'PLASMABLDR-T558: PROJ-UI-040 Theme: Editor может редактировать, но не удалять',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T558' } },
    async ({
        page,
        colors,
        colorSteps,
        initialTheme,
        secondTheme,
        colorData,
        tokenValues,
        themesApi,
        createdSystem,
        systems,
        themeCatalog,
    }) => {
        expect(secondTheme.id, 'Подготовлены независимые темы A и B').not.toBe(initialTheme.id);
        const scope = new URL(themesApi.listURL);
        const deletes: string[] = [];
        const observe = (request: Request) => {
            const url = new URL(request.url());
            if (
                request.method() === 'DELETE' &&
                url.origin === scope.origin &&
                (url.pathname === scope.pathname || url.pathname.startsWith(scope.pathname + '/'))
            ) {
                deletes.push(url.pathname);
            }
        };
        page.on('request', observe);
        try {
            await test.step('Editor открывает Theme A и может редактировать Light textAccent', async () => {
                await colors.open();
                await colors.token('textAccent').click();
                await expect(colors.light).toBeEditable();
                await expect(colors.light).toHaveValue('171717');
                await expect(colors.dark).toHaveValue('F5F5F5');
                await expect(colors.inspector.getByText('Только просмотр', { exact: true })).toHaveCount(0);
            });

            await test.step('Ввод Light с Enter автоматически сохраняется и переживает reload', async () => {
                await colorSteps.saveLightInline('#3366CC', tokenValues.colorURL(initialTheme.id, colorData.accent.id));
                await colors.reload();
                await colors.token('textAccent').click();
                await expect(colors.light).toHaveValue('3366CC');
                await expect(colors.dark).toHaveValue('F5F5F5');
                await expect(colors.light).toBeEditable();
                const valuesB = await tokenValues.values(secondTheme.id, 'color,gradient');
                expect(exactValue(valuesB, colorData.accent.id, 'light').value, 'Исходный Light B сохранён').toBe(
                    '#171717',
                );
                expect(exactValue(valuesB, colorData.accent.id, 'dark').value, 'Исходный Dark B сохранён').toBe(
                    '#F5F5F5',
                );
            });

            await test.step('Меню Theme A доступно Editor, но удалить тему через UI нельзя', async () => {
                await themeCatalog.openFromEditor(createdSystem.name, initialTheme.name);
                await expect(page).toHaveURL(systems.systemURL(createdSystem.id));
                await themeCatalog.openActions(initialTheme.name);
                await expect(themeCatalog.menu.getByRole('menuitem', { name: 'Настройки', exact: true })).toBeVisible();
                await expect(
                    themeCatalog.menu.getByRole('menuitem', { name: 'Переименовать', exact: true }),
                ).toBeVisible();
                await expect(themeCatalog.menu.getByRole('menuitem', { name: /Удалить/u })).toHaveCount(0);
                const themes = await themesApi.list();
                expect(themes.map((theme) => theme.id).sort(), 'Обе темы сохранены').toEqual(
                    [initialTheme.id, secondTheme.id].sort(),
                );
                expect(deletes, 'Editor не отправлял DELETE темы').toEqual([]);
            });
        } finally {
            page.off('request', observe);
        }
    },
);
