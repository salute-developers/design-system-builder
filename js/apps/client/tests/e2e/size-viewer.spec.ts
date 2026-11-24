import type { Request } from '@playwright/test';
import { test, expect } from '../fixtures/role-sizes.ts';
import { readSizeValues } from '../helpers/size-data.ts';

test.use({ memberRole: 'viewer', viewport: { width: 1440, height: 900 } });

test(
    'PLASMABLDR-T759: RSS-025 — Только просмотр для Viewer',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T759' } },
    async ({ page, environment, roleProject, createdSystem, initialTheme, tokenValues, sizeData, viewerSizes }) => {
        const scope = new URL(
            `api/projects/${encodeURIComponent(roleProject.id)}/design-systems/${encodeURIComponent(createdSystem.id)}/`,
            environment.gatewayBaseURL,
        );
        const writes: string[] = [];
        const observe = (request: Request) => {
            const url = new URL(request.url());
            if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
            const path = url.pathname.slice(scope.pathname.length);
            // Предметные записи токенов/значений: включая bulk token-values и size-token CRUD.
            // Технические POST вне этих ресурсов (и OAuth) не являются изменениями RSS.
            if (
                ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) &&
                /^(?:tokens(?:\/|$)|tenants\/[^/]+\/(?:token-values|size-tokens)(?:\/|$))/u.test(path)
            )
                writes.push(request.method() + ' ' + url.pathname);
        };
        page.on('request', observe);
        try {
            await test.step('Viewer открывает раздел: видны дерево, борд, инспектор и «Только просмотр»', async () => {
                await viewerSizes.open();
                await expect(viewerSizes.viewer).toHaveText('Только просмотр');
                await expect(viewerSizes.tree).toBeVisible();
                await expect(viewerSizes.board).toBeVisible();
                await expect(viewerSizes.inspector).toBeVisible();
                await expect(viewerSizes.row(sizeData.m.id)).toBeVisible();
                await expect(viewerSizes.tile('round.m')).toBeVisible();
            });

            await test.step('Viewer читает RSS-BASE; поля и действия изменения недоступны', async () => {
                for (const [token, value] of [
                    [sizeData.m, '8'],
                    [sizeData.l, '16'],
                    [sizeData.circle, 'Full'],
                ] as const) {
                    await viewerSizes.selectRadius(token.id);
                    await expect(viewerSizes.row(token.id)).toHaveClass(/\bis-selected\b/u);
                    await expect(viewerSizes.value).toHaveValue(value);
                    await expect(viewerSizes.value).toBeDisabled();
                    await expect(viewerSizes.mutationControls).toHaveCount(0);
                }
                await viewerSizes.select('spacing', sizeData.spacing.id);
                await expect(viewerSizes.value).toHaveValue('8');
                await expect(viewerSizes.value).toBeDisabled();
                await viewerSizes.value.focus();
                await expect(viewerSizes.value).not.toBeFocused();
                await expect(viewerSizes.mutationControls).toHaveCount(0);

                await viewerSizes.select('shadow', sizeData.shadow.id);
                await expect(viewerSizes.layers).toHaveCount(1);
                await expect(viewerSizes.layers.first()).toBeVisible();
                for (const [field, value] of [
                    ['X', '0'],
                    ['Y', '4'],
                    ['Blur', '8'],
                    ['Spread', '0'],
                    ['HEX', '000000'],
                ] as const) {
                    await expect(viewerSizes.layerField(field)).toHaveValue(value);
                    await expect(viewerSizes.layerField(field)).toBeDisabled();
                }
                await expect(viewerSizes.opacity).toHaveValue('16');
                await expect(viewerSizes.opacity).toBeDisabled();
                await expect(viewerSizes.colorPicker).toBeDisabled();
                await viewerSizes.layerField('Y').focus();
                await expect(viewerSizes.layerField('Y')).not.toBeFocused();
                await expect(viewerSizes.inspector.locator('input:enabled')).toHaveCount(0);
                await expect(viewerSizes.mutationControls).toHaveCount(0);
            });

            await test.step('Выбор через дерево и борд работает без изменения значений и запросов записи', async () => {
                await viewerSizes.selectRadius(sizeData.m.id);
                await expect(viewerSizes.value).toHaveValue('8');
                await viewerSizes.tile('round.l').click();
                await expect(viewerSizes.tile('round.l')).toHaveAttribute('aria-pressed', 'true');
                await expect(viewerSizes.row(sizeData.l.id)).toHaveClass(/\bis-selected\b/u);
                await expect(viewerSizes.inspector.getByText('round.l', { exact: true })).toBeVisible();
                await expect(viewerSizes.value).toHaveValue('16');
                await expect(viewerSizes.value).toBeDisabled();
                await expect(viewerSizes.viewer).toHaveText('Только просмотр');
                expect(
                    await readSizeValues(tokenValues, initialTheme.id, {
                        m: sizeData.m,
                        l: sizeData.l,
                        circle: sizeData.circle,
                        spacing: sizeData.spacing,
                        shadow: sizeData.shadow,
                    }),
                    'Owner GET: значения и редакции RSS-BASE сохранились',
                ).toEqual(sizeData.baseline);
                expect(writes, 'Viewer не отправлял изменений токенов/значений своей ДС').toEqual([]);
            });
        } finally {
            page.off('request', observe);
        }
    },
);
