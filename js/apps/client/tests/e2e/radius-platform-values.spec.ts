import { test, expect } from '../fixtures/platform-sizes.ts';
import { readSizeView } from '../helpers/size-data.ts';
import { commitField, saveSize, observeWrites } from '../steps/value-editing.steps.ts';

test.use({ memberRole: 'editor', viewport: { width: 1440, height: 900 } });

test(
    'PLASMABLDR-T800: RSS-006 Свой радиус Android: добавить, изменить, снять',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T800' } },
    async ({ sizes, sizeData, tokenValues, initialTheme, pendingMutation, setupSession }) => {
        const id = sizeData.m.id;
        const url = tokenValues.sizeURL(initialTheme.id, id);
        const before = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        const save = (action: () => Promise<unknown>) => saveSize(sizes, pendingMutation, url, action);
        const radius = async () => {
            const matches = (await readSizeView(tokenValues, initialTheme.id, setupSession)).radii.filter(
                (token) => token.tokenId === id,
            );
            expect(matches).toHaveLength(1);
            return matches[0]!;
        };
        await sizes.open();
        await sizes.select('radius', id);
        await expect(sizes.value).toHaveValue('8');
        await save(() => sizes.addPlatform('Android'));
        await expect(sizes.platformValue('Android')).toHaveValue('8');
        expect(await radius()).toMatchObject({ valuePx: 8, platforms: { android: 8 } });
        for (const value of ['12', '18']) {
            await save(() => commitField(sizes.platformValue('Android'), value));
            expect(await radius()).toMatchObject({
                valuePx: 8,
                platforms: { android: Number(value) },
                native: { ios: 8, android: Number(value) },
            });
        }
        const own = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        expect(own.filter((value) => value.tokenId !== id || value.platform !== 'android')).toEqual(
            before.filter((value) => value.tokenId !== id || value.platform !== 'android'),
        );
        expect(own.find((value) => value.tokenId === id && value.platform === 'android')).toMatchObject({
            overridden: true,
        });
        await sizes.reload();
        await sizes.select('radius', id);
        await expect(sizes.platformValue('Android')).toHaveValue('18');
        await save(() =>
            sizes.screen.getByRole('button', { name: 'Убрать своё значение Android', exact: true }).click(),
        );
        await expect(sizes.platformValue('Android')).toHaveCount(0);
        expect(await radius()).toMatchObject({ valuePx: 8, platforms: {}, native: { ios: 8, android: 8 } });
        const after = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        expect(after.find((value) => value.tokenId === id && value.platform === 'android')).toMatchObject({
            overridden: false,
        });
        expect(after.filter((value) => value.tokenId !== id || value.platform !== 'android')).toEqual(
            before.filter((value) => value.tokenId !== id || value.platform !== 'android'),
        );
        await sizes.reload();
        await sizes.select('radius', id);
        await expect(sizes.value).toHaveValue('8');
        await expect(sizes.platformValue('Android')).toHaveCount(0);
    },
);

test(
    'PLASMABLDR-T738: RSS-004 Изменение радиуса и пересчёт вычисляемых',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T738' } },
    async ({ page, sizes, derivedSizeData: sizeData, tokenValues, initialTheme, pendingMutation, setupSession }) => {
        const id = sizeData.l.id;
        const url = tokenValues.sizeURL(initialTheme.id, id);
        const before = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        const baseline = await readSizeView(tokenValues, initialTheme.id, setupSession);
        const source = baseline.radii.find((token) => token.tokenId === id)!;
        expect(source.derived.some((item) => item.offsetPx === -2)).toBe(true);
        await sizes.open();
        await sizes.select('radius', id);
        await expect(sizes.value).toHaveValue('16');
        for (const value of [1, 24]) {
            await saveSize(sizes, pendingMutation, url, () => commitField(sizes.value, String(value)));
            await expect(sizes.row(id).locator('.st-tree-row-value')).toHaveText(value + ' px');
            await expect(sizes.tile('round.l').locator('.st-tile-caption b')).toHaveText(String(value));
            await expect(sizes.tile('round.l').locator('.st-radius-preview')).toHaveCSS('--radius', value + 'px');
            await expect(page.getByRole('main').getByRole('button', { name: /^L − 2, /u })).toHaveAccessibleName(
                new RegExp('^L − 2, ' + Math.max(0, value - 2) + ' px,'),
            );
            const view = await readSizeView(tokenValues, initialTheme.id, setupSession);
            const changed = view.radii.find((token) => token.tokenId === id)!;
            expect(changed.valuePx).toBe(value);
            expect(changed.derived).toEqual(
                source.derived.map((item) => ({ ...item, valuePx: Math.max(0, value + item.offsetPx) })),
            );
            expect(view.radii.filter((token) => token.tokenId !== id)).toEqual(
                baseline.radii.filter((token) => token.tokenId !== id),
            );
        }
        const after = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        expect(after.filter((value) => value.tokenId !== id)).toEqual(before.filter((value) => value.tokenId !== id));
        await sizes.reload();
        await sizes.select('radius', id);
        await expect(sizes.value).toHaveValue('24');
        await expect(sizes.screen.getByTestId('derived-section')).toContainText('22 px');
    },
);

test(
    'PLASMABLDR-T739: RSS-005 Невалидный радиус сохраняет предыдущее значение',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T739' } },
    async ({ page, sizes, sizeData, tokenValues, initialTheme, setupSession }) => {
        const before = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        const baseline = await readSizeView(tokenValues, initialTheme.id, setupSession);
        await sizes.open();
        await sizes.select('radius', sizeData.l.id);
        const observed = observeWrites(page, tokenValues.sizeViewURL(initialTheme.id));
        try {
            for (const [raw, message] of [
                ['-1', 'Значение должно быть в диапазоне 0–1000 px.'],
                ['1001', 'Значение должно быть в диапазоне 0–1000 px.'],
                ['1.5', 'Размер должен быть целым числом.'],
                ['', 'Значение не может быть пустым.'],
                ['abc', 'Размер должен быть числом.'],
            ]) {
                await commitField(sizes.value, raw!);
                await expect(sizes.value).toHaveAttribute('aria-invalid', 'true');
                await expect(sizes.screen.getByText(message!, { exact: true })).toBeVisible();
                await expect(sizes.tile('round.l').locator('.st-tile-caption b')).toHaveText('16');
                expect(await tokenValues.values(initialTheme.id, 'shape,spacing,shadow')).toEqual(before);
            }
            expect(observed.writes).toEqual([]);
            await sizes.reload();
            await sizes.select('radius', sizeData.l.id);
            await expect(sizes.value).toHaveValue('16');
            expect(await readSizeView(tokenValues, initialTheme.id, setupSession)).toEqual(baseline);
            expect(observed.writes).toEqual([]);
        } finally {
            observed.stop();
        }
    },
);
