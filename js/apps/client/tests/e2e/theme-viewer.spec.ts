import type { Request } from '@playwright/test';
import { test, expect } from '../fixtures/role-themes.ts';
import { exactValue } from '../helpers/color-data.ts';

test(
    'PLASMABLDR-T557: PROJ-UI-039 Theme: Viewer открывает editor только для чтения',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T557' } },
    async ({
        page,
        environment,
        roleProject,
        editorURL,
        initialTheme,
        secondTheme,
        colorData,
        tokenValues,
        viewerColors,
        pageReadiness,
    }) => {
        expect(secondTheme.id).not.toBe(initialTheme.id);
        const scope = new URL(
            `api/projects/${encodeURIComponent(roleProject.id)}/design-systems/`,
            environment.gatewayBaseURL,
        );
        const writes: string[] = [];
        const observe = (request: Request) => {
            const url = new URL(request.url());
            if (
                url.origin === scope.origin &&
                url.pathname.startsWith(scope.pathname) &&
                ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
            )
                writes.push(request.method() + ' ' + url.pathname);
        };
        const checkValues = async () => {
            await expect(viewerColors.readOnly).toBeVisible();
            await expect(viewerColors.light).toHaveValue('171717');
            await expect(viewerColors.dark).toHaveValue('F5F5F5');
        };
        page.on('request', observe);
        try {
            await test.step('Viewer открывает Theme A и выбирает textAccent', async () => {
                await pageReadiness.run('Открытие цветов Viewer', async () => {
                    await page.goto(editorURL);
                    await viewerColors.selectAccent();
                });
                await checkValues();
            });
            await test.step('Редактирование, picker, создание и удаление недоступны', async () => {
                await expect(viewerColors.light).toBeDisabled();
                await expect(viewerColors.dark).toBeDisabled();
                await expect(viewerColors.lightPicker).toBeDisabled();
                await expect(viewerColors.darkPicker).toBeDisabled();
                await viewerColors.light.focus();
                await expect(viewerColors.light).not.toBeFocused();
                await expect(page.getByRole('dialog', { name: /^Color picker:/u })).toHaveCount(0);
                await expect(page.getByRole('button', { name: 'Создать токен', exact: true })).toHaveCount(0);
                await expect(page.getByRole('button', { name: 'Удалить токен', exact: true })).toHaveCount(0);
            });
            await test.step('После reload исходные значения сохранены, запросов записи не было', async () => {
                await pageReadiness.run('Цвета Viewer после reload', async () => {
                    await page.reload();
                    await viewerColors.selectAccent();
                });
                await checkValues();
                const values = await tokenValues.values(initialTheme.id, 'color,gradient');
                expect(exactValue(values, colorData.accent.id, 'light').value).toBe('#171717');
                expect(exactValue(values, colorData.accent.id, 'dark').value).toBe('#F5F5F5');
                expect(writes, 'Viewer не отправлял мутаций темы').toEqual([]);
            });
        } finally {
            page.off('request', observe);
        }
    },
);
