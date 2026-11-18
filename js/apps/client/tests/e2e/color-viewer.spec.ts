import type { Request } from '@playwright/test';
import { test as base, expect } from '../fixtures/role-colors.ts';
import { exactValue } from '../helpers/color-data.ts';
import { ViewerColorTokensPage } from '../pages/viewer-color-tokens.page.ts';

const test = base.extend<{ viewerTokens: ViewerColorTokensPage }>({
    viewerTokens: async ({ page }, use) => {
        await use(new ViewerColorTokensPage(page));
    },
});

test.use({ memberRole: 'viewer' });

test(
    'PLASMABLDR-T631: CT-070 Viewer не может изменять цвет',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T631' } },
    async ({
        page,
        environment,
        roleProject,
        createdSystem,
        editorURL,
        initialTheme,
        colorData,
        tokenValues,
        viewerTokens,
        pageReadiness,
    }) => {
        const scope = new URL(
            'api/projects/' +
                encodeURIComponent(roleProject.id) +
                '/design-systems/' +
                encodeURIComponent(createdSystem.id) +
                '/',
            environment.gatewayBaseURL,
        );
        const writes: string[] = [];
        const observe = (request: Request) => {
            const url = new URL(request.url());
            if (
                url.origin === scope.origin &&
                url.pathname.startsWith(scope.pathname) &&
                ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
            ) {
                writes.push(request.method() + ' ' + url.pathname);
            }
        };
        page.on('request', observe);
        try {
            await test.step('Viewer читает Light/Dark и связанные подтемы textAccent', async () => {
                await pageReadiness.run('Открытие цветов Viewer для CT-070', async () => {
                    await page.goto(editorURL);
                    await viewerTokens.selectAccent();
                });
                await expect(viewerTokens.light).toHaveValue('171717');
                await expect(viewerTokens.dark).toHaveValue('F5F5F5');
                await expect(viewerTokens.subthemes.getByRole('heading')).toHaveText([
                    'Подтемы',
                    'OnDark',
                    'OnLight',
                    'Inverse',
                ]);
                const linkedValues = [
                    ['F5F5F5', 'F5F5F5'],
                    ['171717', '171717'],
                    ['F5F5F5', '171717'],
                ] as const;
                await expect(viewerTokens.contextLinks).toHaveCount(3);
                for (const [index, [light, dark]] of linkedValues.entries()) {
                    await expect(
                        viewerTokens.subthemes.getByRole('textbox', { name: 'Light', exact: true }).nth(index),
                    ).toHaveValue(light);
                    await expect(
                        viewerTokens.subthemes.getByRole('textbox', { name: 'Dark', exact: true }).nth(index),
                    ).toHaveValue(dark);
                    await expect(viewerTokens.contextLinks.nth(index)).toHaveAttribute('aria-pressed', 'true');
                    await expect(viewerTokens.contextLinks.nth(index)).toBeDisabled();
                }
            });

            await test.step('Цвет, связи, создание, удаление и переименование недоступны', async () => {
                await expect(viewerTokens.light).toBeDisabled();
                await expect(viewerTokens.dark).toBeDisabled();
                await expect(viewerTokens.lightPicker).toBeDisabled();
                await expect(viewerTokens.darkPicker).toBeDisabled();
                await expect(viewerTokens.inspector.locator('input:enabled')).toHaveCount(0);
                await expect(
                    viewerTokens.subthemes.getByRole('button', { name: 'Сбросить подтемы', exact: true }),
                ).toBeDisabled();
                await viewerTokens.lightPicker.focus();
                await expect(viewerTokens.lightPicker).not.toBeFocused();
                await viewerTokens.contextLinks.first().focus();
                await expect(viewerTokens.contextLinks.first()).not.toBeFocused();
                await expect(viewerTokens.picker).toHaveCount(0);
                await expect(viewerTokens.platformControls).toHaveCount(0);
                await expect(viewerTokens.treeMutationControls).toHaveCount(0);
                await expect(viewerTokens.nameEditor).toHaveCount(0);
                await viewerTokens.token('textAccent').dblclick();
                await expect(viewerTokens.tree.getByRole('textbox')).toHaveCount(0);
            });

            await test.step('Перетаскивание не меняет порядок токенов Viewer', async () => {
                const originalOrder = await viewerTokens.rows.allTextContents();
                await expect(viewerTokens.tree.locator('[draggable="true"]')).toHaveCount(0);
                await expect(viewerTokens.token('textAccent')).toHaveAttribute('draggable', 'false');
                await viewerTokens.token('textAccent').dragTo(viewerTokens.token('textPromoMinor'));
                await expect(viewerTokens.rows).toHaveText(originalOrder);
            });

            await test.step('Просмотр другого токена и плитки на канвасе работает без мутаций', async () => {
                await viewerTokens.token('textPromoMinor').click();
                await expect(viewerTokens.light).toHaveValue('FFFFFF');
                await expect(viewerTokens.readOnly).toBeVisible();
                // Согласованная актуализация Excel: вместо Button выбирается плитка токена цветов.
                await viewerTokens.accentTile.click();
                await expect(viewerTokens.accentTile).toHaveAttribute('aria-pressed', 'true');
                await expect(viewerTokens.token('textAccent')).toHaveClass(/\bis-selected\b/u);
                await expect(viewerTokens.light).toHaveValue('171717');
                await expect(viewerTokens.dark).toHaveValue('F5F5F5');
                await expect(viewerTokens.readOnly).toBeVisible();
                await expect(viewerTokens.light).toBeDisabled();
                const values = await tokenValues.values(initialTheme.id, 'color,gradient');
                expect(exactValue(values, colorData.accent.id, 'light').value).toBe('#171717');
                expect(exactValue(values, colorData.accent.id, 'dark').value).toBe('#F5F5F5');
                expect(exactValue(values, colorData.neighbor.id, 'light').value).toBe('#FFFFFF');
                expect(writes, 'Viewer не отправлял мутаций своей ДС').toEqual([]);
            });
        } finally {
            page.off('request', observe);
        }
    },
);
