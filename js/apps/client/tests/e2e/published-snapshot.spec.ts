import type { Request } from '@playwright/test';
import { test, expect, snapshotPalette, draftColor, draftFontSize } from '../fixtures/published-snapshot.ts';
import { green } from '../helpers/palette.api.ts';
import { cssColor } from '../steps/palette.steps.ts';

test.use({ viewport: { width: 1440, height: 900 } });

test(
    'PLASMABLDR-T793: VER-UI-016 Опубликованная версия и возврат в черновик',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T793' } },
    async ({ page, snapshot, colors, palette, sizes, journal, versions, versionsApi }) => {
        const { version, shadowId, accentGroupId, historicalLight, publishedChanges } = snapshot;
        const versionPath = (url: URL) => url.searchParams.get('versionId') === version.id;
        const viewer = page.getByText('Только просмотр', { exact: true });
        const step = palette.step(accentGroupId, green, 500);
        const editStep = palette.inspector.getByRole('button', { name: 'Изменить цвет', exact: true });
        const typography = page.getByRole('button', { name: 'Типографика', exact: true });
        const body = page.getByRole('button', { name: /^Body M, /u });
        const fontSize = page.getByRole('textbox', { name: 'Size', exact: true });
        const shadowPreview = sizes.shadowPreview('down.hard.m');
        const selectStep = async () => {
            await palette.navigationButton.click();
            await palette.colorMode.click();
            await step.click();
        };
        const selectBody = async () => {
            await typography.click();
            await body.click();
        };
        const selectShadow = async () => {
            await sizes.navigationButton.click();
            await sizes.select('shadow', shadowId);
        };

        const writes: string[] = [];
        const api = new URL(versionsApi.createURL);
        const projectPath = api.pathname.slice(0, api.pathname.lastIndexOf('/') + 1);
        const observe = (request: Request) => {
            const url = new URL(request.url());
            if (
                url.origin === api.origin &&
                url.pathname.startsWith(projectPath) &&
                ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
            ) {
                writes.push(request.method() + ' ' + url.pathname);
            }
        };
        page.on('request', observe);
        try {
            await test.step('Открыть текущий черновик, затем выбрать v0.1.0 в редакторе', async () => {
                await colors.open();
                await colors.token('textAccent').click();
                await expect(versions.editorVersionButton).toHaveText('Черновик');
                await expect(colors.light).toHaveValue(draftColor.slice(1));
                await versions.editorVersionButton.click();
                await page.getByRole('option', { name: 'v' + version.version, exact: true }).click();
                await expect(page).toHaveURL(versionPath);
            });

            await test.step('Цвет, палитра, типографика и тень показывают снимок только для просмотра', async () => {
                await expect(viewer).toBeVisible();
                await colors.token('textAccent').click();
                // Инспектор снимка скрыт из дерева доступности, но отображает заблокированные поля.
                const defaults = colors.inspector.locator('section').filter({ hasText: 'Темы по умолчанию' });
                const light = defaults.locator('input[aria-label="Light"]');
                await expect(light).toHaveValue(historicalLight.slice(1).toUpperCase());
                await expect(light).toBeDisabled();
                await expect(defaults.locator('button[aria-label="Выбор цвета: Light"]')).toBeDisabled();
                await light.press('3');
                await light.press('Enter');
                await expect(light).toHaveValue(historicalLight.slice(1).toUpperCase());

                await selectStep();
                await expect(page).toHaveURL(versionPath);
                await expect(viewer).toBeVisible();
                await expect(step).toHaveCSS('background-color', cssColor(snapshotPalette.published));
                await expect(editStep).toHaveCount(0);

                await selectBody();
                await expect(page).toHaveURL(versionPath);
                await expect(viewer).toBeVisible();
                await expect(body).toHaveAccessibleName('Body M, 16 px, 20 px line');
                await expect(fontSize).toHaveValue('16');
                for (const name of ['Size', 'Line Height', 'Letter Spacing']) {
                    await expect(page.getByRole('textbox', { name, exact: true })).toBeDisabled();
                }
                await expect(
                    page.getByRole('button', {
                        name: /^(Добавить группу|Добавить стиль в |Удалить стиль(?: |$)|Удалить группу )/u,
                    }),
                ).toHaveCount(0);

                await selectShadow();
                await expect(page).toHaveURL(versionPath);
                await expect(sizes.viewer).toBeVisible();
                await expect(sizes.layerField('X')).toHaveValue('0');
                for (const field of ['X', 'Y', 'Blur', 'Spread', 'HEX'] as const) {
                    await expect(sizes.layerField(field)).toBeDisabled();
                }
                await expect(
                    sizes.screen.getByRole('button', {
                        name: /^(Свои слои платформы|\+ Добавить слой|Удалить слой |Удалить токен(?: |$))/u,
                    }),
                ).toHaveCount(0);
                await expect(shadowPreview).toHaveCSS('box-shadow', / 0px 16px 32px -8px$/u);
            });

            await test.step('Журнал и история показывают границу публикации без изменения данных', async () => {
                await journal.navigationButton.click();
                await expect(page).toHaveURL(versionPath);
                await journal.list
                    .getByRole('button', {
                        name: 'Ступень палитры: Green 500 Цвет · Группа: Accent',
                        exact: true,
                    })
                    .click();
                const count = new RegExp('^' + publishedChanges + ' изменени(?:е|я|й)$', 'u');
                await expect(journal.list.getByText(count)).toBeVisible();
                await expect(journal.list.getByRole('heading', { level: 2 })).toHaveText([
                    /^Темы · 1$/u,
                    /^Палитра · \d+$/u,
                ]);
                const details = page.getByRole('complementary', { name: 'Подробности изменения', exact: true });
                await expect(details.getByText(snapshotPalette.published, { exact: true })).toBeVisible();
                await expect(details.getByText(snapshotPalette.draft, { exact: true })).toHaveCount(0);
                await expect(journal.list.getByRole('button', { name: /^Отменить изменение/u })).toHaveCount(0);
                await expect(details.getByRole('button', { name: 'Отменить изменение', exact: true })).toHaveCount(0);

                await versions.navigationButton.click();
                await versions.version(version.version).click();
                await expect(page).toHaveURL(
                    (url) => versionPath(url) && url.searchParams.get('historyVersionId') === version.id,
                );
                await expect(versions.content.getByText(/^Опубликована · \d/u)).toBeVisible();
                await expect(versions.content.getByText(version.changelog, { exact: true })).toBeVisible();
                await expect(
                    versions.content.getByRole('heading', { name: 'Включённые изменения', exact: true }),
                ).toBeVisible();
                await expect(
                    versions.content.getByRole('button', { name: /^Ступень палитры: Green 500/u }),
                ).toBeVisible();
                await expect(versions.versionInput).toHaveCount(0);
                await expect(versions.notesInput).toHaveCount(0);
                await expect(versions.publishButton).toHaveCount(0);
            });

            await test.step('Вернуться в черновик и проверить актуальные значения и возможность правки', async () => {
                await versions.editorVersionButton.click();
                await versions.editorDraftOption.click();
                await expect(versions.editorVersionButton).toHaveText('Черновик');
                await versions.editorButton.click();
                await expect(page).toHaveURL((url) => !url.searchParams.has('versionId'));
                await colors.token('textAccent').click();
                await expect(colors.light).toHaveValue(draftColor.slice(1));
                await expect(colors.light).toBeEditable();

                await selectStep();
                await expect(step).toHaveCSS('background-color', cssColor(snapshotPalette.draft));
                await expect(editStep).toBeEnabled();

                await selectBody();
                await expect(fontSize).toHaveValue(String(draftFontSize));
                await expect(fontSize).toBeEditable();

                await selectShadow();
                await expect(shadowPreview).toHaveCSS('box-shadow', / 4px 24px 40px -6px$/u);
                await expect(sizes.layerField('X')).toHaveValue('4');
                await expect(sizes.layerField('X')).toBeEditable();
                expect(writes, 'Чтение снимка и заблокированный ввод не создают мутаций').toEqual([]);
            });
        } finally {
            page.off('request', observe);
        }
    },
);
