import { test, expect } from '../fixtures/palette.ts';
import { paletteGroup, paletteStep, green } from '../helpers/palette.api.ts';
import { applyPaletteStep, cssColor } from '../steps/palette.steps.ts';

test.use({ viewport: { width: 1440, height: 900 } });

test(
    'PLASMABLDR-T776: PAL-021: Правка ступени: сохранение и changed state',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T776' } },
    async ({ page, palette, paletteBaseline, paletteApi, pendingMutation, journal }) => {
        const accent = paletteGroup(paletteBaseline, 'accent');
        const status = paletteGroup(paletteBaseline, 'status');
        const initial = paletteStep(accent, green, 400).value;
        const target = palette.step(accent.id, green, 400);
        const controls = [
            [accent, 300],
            [accent, 500],
            [status, 400],
        ] as const;
        await palette.open();
        await palette.colorMode.click();

        await test.step('Одиночный выбор Accent Green/Hue130 #400 не открывает picker', async () => {
            for (const [group, step] of controls) {
                await expect(palette.step(group.id, green, step)).toHaveCSS(
                    'background-color',
                    cssColor(paletteStep(group, green, step).value),
                );
            }
            await target.click();
            await expect(target).toHaveClass(/\bis-selected\b/u);
            await expect(palette.dialog).toHaveCount(0);
            await expect(palette.inspector.getByText(initial, { exact: true })).toBeVisible();
            await expect(
                target.getByRole('img', { name: 'Цвет отличается от брендовой палитры', exact: true }),
            ).toHaveCount(0);
        });

        await test.step('Открыть picker и сохранить ступень кнопкой «Применить» за 10 секунд', async () => {
            await palette.editSelected('#3366CC');
            await expect(palette.dialog).toHaveAccessibleName('Цвет Green 400');
            await expect(palette.dialog.getByText('Accent / Green · Только эта группа', { exact: true })).toBeVisible();
            await expect(palette.hex).toHaveValue('#3366CC');
            await applyPaletteStep(
                palette,
                target,
                pendingMutation,
                paletteApi.stepURL(accent.id, green, 400),
                '#3366CC',
            );
            await expect(
                target.getByRole('img', { name: 'Цвет отличается от брендовой палитры', exact: true }),
            ).toBeVisible();
        });

        await test.step('Изменённая растяжка и ступень доступны через фильтр', async () => {
            await palette.changedFilter.click();
            await palette.rampMode.click();
            await expect(
                palette.treeGroup(accent.label).getByRole('button', { name: /^Green \/ Hue 130 · Изменена/u }),
            ).toBeVisible();
            await palette.colorMode.click();
            await target.click();
            const steps = palette.treeGroup(accent.label).getByRole('list', { name: 'Цвета Green', exact: true });
            await expect(steps.getByRole('button', { name: '#400 Цвет изменён #3366CC', exact: true })).toBeVisible();
            await expect(steps.getByRole('listitem')).toHaveCount(1);
        });

        await test.step('Журнал содержит правку ступени именно в Accent', async () => {
            await journal.navigationButton.click();
            const entry = journal.list.getByRole('button', {
                name: 'Ступень палитры: Green 400 Цвет · Группа: Accent',
                exact: true,
            });
            await expect(journal.list.getByRole('article')).toHaveCount(1);
            await entry.click();
            const details = page.getByRole('complementary', { name: 'Подробности изменения', exact: true });
            await expect(details.getByText('Ступень палитры: Green 400', { exact: true })).toBeVisible();
            await expect(details.getByText('Палитра', { exact: true })).toBeVisible();
            // Согласовано: до первой правки брендовой ступени явного переопределения нет.
            const before = details.getByText('Было', { exact: true }).locator('..');
            const after = details.getByText('Стало', { exact: true }).locator('..');
            await expect(before.getByText('Не задано', { exact: true })).toBeVisible();
            await expect(after.getByText('#3366CC', { exact: true })).toBeVisible();
            await expect(entry.getByText('Цвет · Группа: Accent', { exact: true })).toBeVisible();
        });

        await test.step('После возврата и reload изменена только целевая ступень', async () => {
            await palette.navigationButton.click();
            await palette.allFilter.click();
            await palette.reload();
            await palette.colorMode.click();
            await expect(target).toHaveCSS('background-color', 'rgb(51, 102, 204)');
            await expect(
                target.getByRole('img', { name: 'Цвет отличается от брендовой палитры', exact: true }),
            ).toBeVisible();
            for (const [group, step] of controls) {
                await expect(palette.step(group.id, green, step)).toHaveCSS(
                    'background-color',
                    cssColor(paletteStep(group, green, step).value),
                );
            }
            await journal.navigationButton.click();
            await expect(journal.list.getByRole('article')).toHaveCount(1);
            await expect(journal.list.getByText('#3366CC', { exact: true })).toBeVisible();
        });
    },
);
