import type { Locator } from '@playwright/test';
import { test, expect } from '../fixtures/sizes.ts';
import { exactDefinition } from '../helpers/color-data.ts';
import type { PendingMutation } from '../helpers/pending-mutation.ts';

test.use({ viewport: { width: 1440, height: 900 } });

async function saveValue(
    field: Locator,
    value: string,
    status: Locator,
    pendingMutation: PendingMutation,
    valueURL: string,
): Promise<unknown> {
    const endpoint = new URL(valueURL);
    await field.fill(value);
    const started = performance.now();
    const response = await pendingMutation.run(
        (response) => {
            const actual = new URL(response.url());
            return (
                response.request().method() === 'PUT' &&
                actual.origin === endpoint.origin &&
                actual.pathname === endpoint.pathname
            );
        },
        async () => {
            await field.press('Tab');
            await expect(status).toHaveText('Сохранение…');
        },
        'Автосохранение размера',
        10_000,
    );
    expect(response.status()).toBe(200);
    await expect(status).toHaveText('Сохранено', {
        timeout: Math.max(1, 10_000 - (performance.now() - started)),
    });
    expect(performance.now() - started, 'Ответ и подтверждение не дольше 10 секунд').toBeLessThanOrEqual(10_000);
    return response.request().postDataJSON();
}

test(
    'PLASMABLDR-T742: RSS-008 — Редактирование отступа и автосохранение',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T742' } },
    async ({ sizes, initialTheme, tokenValues, pendingMutation }) => {
        const token = exactDefinition(await tokenValues.definitions(), 'spacing.4x');
        const treeValue = sizes.row(token.id).locator('.st-tree-row-value');
        const tile = sizes.tile(token.name);
        const boardValue = tile.locator('.st-tile-caption b');
        const preview = tile.locator('.st-spacing-preview');

        await test.step('Выбрать spacing.4x и подтвердить исходные 8 px', async () => {
            await sizes.open();
            await sizes.select('spacing', token.id);
            await expect(sizes.value).toHaveValue('8');
            await expect(treeValue).toHaveText('8 px');
            await expect(boardValue).toHaveText('8');
            await expect(preview).toHaveCSS('--gap', '8px');
        });

        await test.step('Сохранить 12 px и сверить инспектор, дерево и борд', async () => {
            expect(
                await saveValue(
                    sizes.value,
                    '12',
                    sizes.saveStatus,
                    pendingMutation,
                    tokenValues.sizeURL(initialTheme.id, token.id),
                ),
            ).toMatchObject({ valuePx: 12 });
            await expect(sizes.value).toHaveValue('12');
            await expect(treeValue).toHaveText('12 px');
            await expect(boardValue).toHaveText('12');
            await expect(preview).toHaveCSS('--gap', '12px');
        });

        await test.step('После reload тот же отступ остаётся 12 px', async () => {
            await sizes.reload();
            await sizes.select('spacing', token.id);
            await expect(sizes.value).toHaveValue('12');
            await expect(treeValue).toHaveText('12 px');
            await expect(boardValue).toHaveText('12');
            await expect(preview).toHaveCSS('--gap', '12px');
        });
    },
);

test(
    'PLASMABLDR-T750: RSS-016 — Редактирование параметров слоя тени',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T750' } },
    async ({ sizes, initialTheme, tokenValues, pendingMutation }) => {
        const token = exactDefinition(await tokenValues.definitions(), 'down.hard.m');
        const fields = [
            ['X', 'offsetX', '0', '-12'],
            ['Y', 'offsetY', '16', '50'],
            ['Blur', 'blur', '32', '120'],
            ['Spread', 'spread', '-8', '-12'],
        ] as const;
        const preview = sizes.shadowPreview(token.name);

        await test.step('Открыть первый слой Down Hard M', async () => {
            await sizes.open();
            await sizes.select('shadow', token.id);
            await expect(sizes.screen.getByRole('heading', { name: /^Слои(?: |$)/u })).toBeVisible();
            await expect(sizes.layerField('HEX')).toBeVisible();
            for (const [field, , initial] of fields) await expect(sizes.layerField(field)).toHaveValue(initial);
            await expect(preview).toHaveCSS('box-shadow', / 0px 16px 32px -8px$/u);
        });

        await test.step('Сохранить четыре поля и сверить превью', async () => {
            for (const [field, key, , value] of fields) {
                const input = sizes.layerField(field);
                const body = await saveValue(
                    input,
                    value,
                    sizes.saveStatus,
                    pendingMutation,
                    tokenValues.sizeURL(initialTheme.id, token.id),
                );
                expect(body).toMatchObject({ layers: [expect.objectContaining({ [key]: Number(value) })] });
                await expect(input).toHaveValue(value);
            }
            await expect(preview).toHaveCSS('box-shadow', / -12px 50px 120px -12px$/u);
        });

        await test.step('После reload выбрать ту же тень и сверить значения', async () => {
            await sizes.reload();
            await sizes.select('shadow', token.id);
            for (const [field, , , value] of fields) await expect(sizes.layerField(field)).toHaveValue(value);
            await expect(preview).toHaveCSS('box-shadow', / -12px 50px 120px -12px$/u);
        });
    },
);
