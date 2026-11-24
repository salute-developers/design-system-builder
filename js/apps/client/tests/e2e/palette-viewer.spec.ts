import type { Request } from '@playwright/test';
import { test, expect } from '../fixtures/viewer-palette.ts';
import { green } from '../helpers/palette.api.ts';
import { readViewerPalette, viewerPaletteHex } from '../helpers/viewer-palette-data.ts';

test.use({ memberRole: 'viewer', viewport: { width: 1440, height: 900 } });

test(
    'PLASMABLDR-T593: PAL-028 — Viewer видит палитру и ссылки без мутаций',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T593' } },
    async ({
        page,
        environment,
        roleProject,
        createdSystem,
        editorURL,
        initialTheme,
        paletteApi,
        tokenValues,
        viewerPaletteData,
        viewerPalette,
        viewerColors,
    }) => {
        const scope = new URL(
            `api/projects/${encodeURIComponent(roleProject.id)}/design-systems/${encodeURIComponent(createdSystem.id)}`,
            environment.gatewayBaseURL,
        );
        const writes: string[] = [];
        const observe = (request: Request) => {
            const url = new URL(request.url());
            if (
                url.origin !== scope.origin ||
                (url.pathname !== scope.pathname && !url.pathname.startsWith(scope.pathname + '/')) ||
                !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
            )
                return;
            const path = url.pathname.slice(scope.pathname.length + 1);
            // rebuild с preview=true рассчитывает предпросмотр, а не записывает палитру.
            if (
                request.method() === 'POST' &&
                /^tenants\/[^/]+\/palette\/groups\/[^/]+\/ramps\/[^/]+\/[^/]+\/rebuild$/u.test(path) &&
                (request.postDataJSON() as { preview?: boolean } | null)?.preview === true
            )
                return;
            writes.push(request.method() + ' ' + url.pathname);
        };
        page.on('request', observe);
        try {
            await test.step('Viewer читает растяжку и цвет, но не может открыть редакторы или изменить группы', async () => {
                await viewerPalette.open();
                await viewerPalette.rampMode.click();
                const ramp = viewerPalette.greenRamp(viewerPaletteData.accent.label);
                await ramp.click();
                await expect(ramp).toHaveClass(/\bis-selected\b/u);
                await expect(viewerPalette.tree).toBeVisible();
                await expect(viewerPalette.readOnly).toBeVisible();
                await expect(viewerPalette.linkedAccent).toBeVisible();
                await expect(page.getByRole('dialog')).toHaveCount(0);
                await expect(viewerPalette.mutationControls).toHaveCount(0);

                await viewerPalette.colorMode.click();
                const step = viewerPalette.step(viewerPaletteData.accent.id, green, 500);
                await step.click();
                await expect(step).toHaveClass(/\bis-selected\b/u);
                await expect(viewerPalette.inspector.getByText(viewerPaletteHex, { exact: true })).toBeVisible();
                await expect(viewerPalette.inspector.getByText('Green 500', { exact: true })).toBeVisible();
                await step.dblclick();
                await expect(viewerPalette.dialog).toHaveCount(0);
                await expect(viewerPalette.inspector.getByRole('textbox')).toHaveCount(0);
                await expect(viewerPalette.mutationControls).toHaveCount(0);
            });
            await test.step('Поиск Green и очистка сохраняют доступ к подготовленной связи', async () => {
                const step = viewerPalette.step(viewerPaletteData.accent.id, green, 500);
                const neutralStep = viewerPalette.step(
                    viewerPaletteData.neutral.id,
                    { type: 'general', shade: 'gray' },
                    500,
                );
                await viewerPalette.searchButton.click();
                await viewerPalette.search.fill('Green');
                await expect(viewerPalette.search).toHaveValue('Green');
                await expect(step).toBeVisible();
                await expect(neutralStep).toHaveCount(0);
                await viewerPalette.search.fill('');
                await expect(viewerPalette.search).toHaveValue('');
                await expect(neutralStep).toBeVisible();
                await viewerPalette.closeSearchButton.click();
                await expect(viewerPalette.search).toHaveCount(0);
                await step.click();
                await expect(viewerPalette.linkedAccent).toBeVisible();
            });
            await test.step('Viewer видит связи группы и всех групп и открывает связанный токен', async () => {
                await expect(viewerPalette.linkedAccent).toBeVisible();
                await viewerPalette.allLinks.click();
                await expect(viewerPalette.allLinks).toHaveAttribute('aria-selected', 'true');
                await expect(viewerPalette.linkedAccent).toBeVisible();
                await viewerPalette.linkedAccent.click();
                await expect(page).toHaveURL(editorURL);
                await expect(page.getByRole('button', { name: 'textAccent', exact: true })).toHaveClass(
                    /\bis-selected\b/u,
                );
                await expect(viewerColors.readOnly).toBeVisible();
                await expect(viewerColors.light).toHaveValue('Green 500');
                await expect(viewerColors.light).toBeDisabled();
                await expect(viewerColors.lightPicker).toBeDisabled();
            });
            await test.step('Возврат в палитру сохраняет данные и запреты Viewer', async () => {
                await viewerPalette.navigationButton.click();
                await viewerPalette.waitForReady();
                await expect(page).toHaveURL(editorURL.replace(/\/colors$/u, '/palette'));
                await expect(viewerPalette.treeGroup(viewerPaletteData.accent.label)).toBeVisible();
                await viewerPalette.colorMode.click();
                const step = viewerPalette.step(viewerPaletteData.accent.id, green, 500);
                await step.click();
                await expect(viewerPalette.inspector.getByText('Green 500', { exact: true })).toBeVisible();
                await expect(viewerPalette.inspector.getByText(viewerPaletteHex, { exact: true })).toBeVisible();
                await expect(viewerPalette.linkedAccent).toBeVisible();
                await expect(viewerPalette.readOnly).toBeVisible();
                await step.dblclick();
                await expect(viewerPalette.dialog).toHaveCount(0);
                await expect(viewerPalette.inspector.getByRole('textbox')).toHaveCount(0);
                await expect(viewerPalette.mutationControls).toHaveCount(0);
            });
            await test.step('Палитра, ссылки и ревизии не изменились; браузер не отправлял запросов записи', async () => {
                expect(
                    await readViewerPalette(paletteApi, tokenValues, initialTheme.id, viewerPaletteData.token.id),
                    'Независимый Owner GET после просмотра',
                ).toEqual(viewerPaletteData.baseline);
                expect(writes, 'Нет мутаций своей ДС').toEqual([]);
            });
        } finally {
            page.off('request', observe);
        }
    },
);
