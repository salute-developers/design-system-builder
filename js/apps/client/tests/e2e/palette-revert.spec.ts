import { test as base, expect } from '../fixtures/palette.ts';
import { paletteGroup, paletteStep, green } from '../helpers/palette.api.ts';
import type { ThemePalette } from '../helpers/palette.api.ts';
import { applyPaletteStep, cssColor } from '../steps/palette.steps.ts';

const initialHex = '#197844';
const changedHex = '#3366CC';
const test = base.extend<{ revertBaseline: ThemePalette }>({
    revertBaseline: [
        async ({ paletteApi, versionsApi }, use) => {
            const accent = paletteGroup(await paletteApi.prepare(), 'accent');
            // Явное исходное значение нужно для сравнения двух HEX в журнале.
            await paletteApi.seedStep(accent.id, green, 500, initialHex);
            const palette = await paletteApi.get();
            expect(paletteStep(paletteGroup(palette, 'accent'), green, 500).value).toBe(initialHex);
            await versionsApi.publish('0.1.0', 'QA palette revert baseline');
            expect(await versionsApi.changes()).toEqual([]);
            await use(palette);
        },
        { timeout: 120_000 },
    ],
});
test.use({ viewport: { width: 1440, height: 900 } });

test(
    'PLASMABLDR-T604: PAL-040 Журнал правки ступени: до/после и восстановление',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T604' } },
    async ({ page, palette, revertBaseline, paletteApi, journal, versionsApi, pendingMutation }) => {
        const accent = paletteGroup(revertBaseline, 'accent');
        const target = palette.step(accent.id, green, 500);
        const controls = [
            [accent, 400],
            [accent, 600],
            [paletteGroup(revertBaseline, 'status'), 500],
            [paletteGroup(revertBaseline, 'syntax'), 500],
        ] as const;
        const checkControls = async () => {
            for (const [group, step] of controls) {
                await expect(palette.step(group.id, green, step)).toHaveCSS(
                    'background-color',
                    cssColor(paletteStep(group, green, step).value),
                );
            }
        };

        await test.step('Зафиксировать исходный HEX и сохранить новый цвет Accent Green #500', async () => {
            await palette.open();
            await palette.colorMode.click();
            await target.click();
            await expect(target).toHaveCSS('background-color', cssColor(initialHex));
            await expect(palette.inspector.getByText(initialHex, { exact: true })).toBeVisible();
            await checkControls();
            await palette.editSelected(changedHex);
            await expect(palette.dialog).toHaveAccessibleName('Цвет Green 500');
            await applyPaletteStep(
                palette,
                target,
                pendingMutation,
                paletteApi.stepURL(accent.id, green, 500),
                changedHex,
            );
            await checkControls();
        });

        await test.step('Проверить до/после и отменить ровно эту запись', async () => {
            await journal.navigationButton.click();
            await expect(journal.list.getByRole('article')).toHaveCount(1);
            await journal.list
                .getByRole('button', {
                    name: 'Ступень палитры: Green 500 Цвет · Группа: Accent',
                    exact: true,
                })
                .click();
            const details = page.getByRole('complementary', { name: 'Подробности изменения', exact: true });
            await expect(details.getByText('Ступень палитры: Green 500', { exact: true })).toBeVisible();
            await expect(details.getByText(/Группа: Accent/u)).toBeVisible();
            for (const [label, hex] of [
                ['Было', initialHex],
                ['Стало', changedHex],
            ] as const) {
                const chip = details.getByText(label, { exact: true }).locator('..');
                await expect(chip.getByText(hex, { exact: true })).toBeVisible();
                await expect(chip.locator('i[aria-hidden="true"]')).toHaveCSS('background-color', cssColor(hex));
            }
            const changes = await versionsApi.changes();
            expect(changes).toHaveLength(1);
            expect(changes[0]).toMatchObject({ entityType: 'palette-step', changeId: expect.any(String) });
            const endpoint = new URL(versionsApi.revertURL((changes[0] as { changeId: string }).changeId));
            const started = performance.now();
            const response = await pendingMutation.run(
                (response) => {
                    const actual = new URL(response.url());
                    return (
                        response.request().method() === 'POST' &&
                        actual.origin === endpoint.origin &&
                        actual.pathname === endpoint.pathname
                    );
                },
                () => details.getByRole('button', { name: 'Отменить изменение', exact: true }).click(),
                'Откат ступени Accent Green #500',
                10_000,
            );
            expect(response.status()).toBe(200);
            await expect(journal.emptyHeading).toBeVisible({
                timeout: Math.max(1, 10_000 - (performance.now() - started)),
            });
            expect(performance.now() - started).toBeLessThanOrEqual(10_000);
        });

        await test.step('После reload исходная ступень и контрольные цвета совпадают', async () => {
            await palette.navigationButton.click();
            await palette.reload();
            await palette.colorMode.click();
            await target.click();
            await expect(target).toHaveCSS('background-color', cssColor(initialHex));
            await expect(palette.inspector.getByText(initialHex, { exact: true })).toBeVisible();
            await checkControls();
        });
    },
);
