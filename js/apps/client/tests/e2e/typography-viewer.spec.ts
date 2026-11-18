import type { Request } from '@playwright/test';
import { test, expect } from '../fixtures/viewer-typography.ts';
import { readViewerTypography, viewerTypographyScreens } from '../helpers/viewer-typography-data.ts';

test.use({ memberRole: 'viewer', viewport: { width: 1440, height: 900 } });

test(
    'PLASMABLDR-T709: TYP-UI-046 — Viewer просматривает типографику',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T709' } },
    async ({
        page,
        environment,
        roleProject,
        createdSystem,
        initialTheme,
        tokenValues,
        viewerTypographyData,
        viewerTypography,
    }) => {
        const scope = new URL(
            `api/projects/${encodeURIComponent(roleProject.id)}/design-systems/${encodeURIComponent(createdSystem.id)}/`,
            environment.gatewayBaseURL,
        );
        const writes: string[] = [];
        const observe = (request: Request) => {
            const url = new URL(request.url());
            if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
            const path = url.pathname.slice(scope.pathname.length);
            if (
                ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) &&
                /^(?:tokens(?:\/|$)|tenants\/[^/]+\/(?:token-values|typography-styles|typography-groups)(?:\/|$))/u.test(
                    path,
                )
            ) {
                writes.push(request.method() + ' ' + url.pathname);
            }
        };
        page.on('request', observe);
        try {
            await test.step('Viewer видит дерево, предпросмотр и инспектор типографики', async () => {
                await viewerTypography.open();
                await expect(viewerTypography.tree).toBeVisible();
                await expect(viewerTypography.bodyM).toBeVisible();
                await expect(viewerTypography.inspector).toBeVisible();
                await expect(viewerTypography.readOnly).toBeVisible();
            });
            await test.step('Три экрана показывают свои web/iOS значения, все поля и действия записи недоступны', async () => {
                for (const { screen, label, size, lineHeight, iosSize } of viewerTypographyScreens) {
                    await viewerTypography.selectScreen(label);
                    await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute(
                        'aria-selected',
                        'true',
                    );
                    await expect(viewerTypography.bodyMRow).toHaveClass(/\bis-selected\b/u);
                    await expect(viewerTypography.size).toHaveValue(String(size));
                    if (screen === 'l') {
                        await expect(viewerTypography.iosSize).toHaveValue(String(iosSize));
                        await expect(viewerTypography.iosSize).toBeDisabled();
                    } else {
                        await expect(
                            viewerTypography.iosSize,
                            'Свое значение iOS задано только на крупных экранах',
                        ).toHaveCount(0);
                    }
                    await expect(viewerTypography.lineHeight).toHaveValue(String(lineHeight));
                    await expect(viewerTypography.letterSpacing).toHaveValue('0');
                    for (const field of [
                        viewerTypography.size,
                        viewerTypography.lineHeight,
                        viewerTypography.letterSpacing,
                    ])
                        await expect(field).toBeDisabled();
                    for (const name of ['Семейство шрифта', 'Начертание', 'Weight Regular']) {
                        await expect(
                            viewerTypography.inspector.getByRole('button', { name, exact: true }),
                        ).toBeDisabled();
                    }
                    await expect(viewerTypography.mutationControls).toHaveCount(0);
                    await expect(viewerTypography.readOnly).toBeVisible();
                }
            });
            await test.step('Возврат через дерево сохраняет значения; Viewer не отправляет мутаций', async () => {
                await viewerTypography.selectScreen('Крупные');
                await viewerTypography.bodyMRow.click();
                await expect(viewerTypography.size).toHaveValue('16');
                await expect(viewerTypography.iosSize).toHaveValue('17');
                await viewerTypography.iosSize.focus();
                await expect(viewerTypography.iosSize).not.toBeFocused();
                expect(
                    await readViewerTypography(tokenValues, initialTheme.id, viewerTypographyData.tokens),
                    'Owner GET: значения, свои платформы и редакции не изменились',
                ).toEqual(viewerTypographyData.baseline);
                expect(writes, 'Нет browser-записей токенов или типографики своей ДС').toEqual([]);
            });
        } finally {
            page.off('request', observe);
        }
    },
);
