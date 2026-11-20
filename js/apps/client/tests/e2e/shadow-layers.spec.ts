import { test, expect } from '../fixtures/platform-sizes.ts';
import { readSizeView, type ShadowLayer } from '../helpers/size-data.ts';
import { commitField, saveSize } from '../steps/value-editing.steps.ts';

test.use({ memberRole: 'editor', viewport: { width: 1440, height: 900 } });

const baselineLayer: ShadowLayer = { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: '#00000029' };
const addedLayer: ShadowLayer = { offsetX: 3, offsetY: 9, blur: 4, spread: 0, color: '#0000001F' };

test(
    'PLASMABLDR-T751: RSS-017 Добавление и удаление слоёв тени',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T751' } },
    async ({ sizes, sizeData, tokenValues, initialTheme, setupSession, pendingMutation }) => {
        const id = sizeData.shadow.id;
        const url = tokenValues.sizeURL(initialTheme.id, id);
        const before = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        const shadow = async () => {
            const matches = (await readSizeView(tokenValues, initialTheme.id, setupSession)).shadows.filter(
                (token) => token.tokenId === id,
            );
            expect(matches).toHaveLength(1);
            return matches[0]!;
        };
        const save = (action: () => Promise<unknown>) => saveSize(sizes, pendingMutation, url, action);
        await sizes.open();
        await sizes.select('shadow', id);
        expect((await shadow()).layers).toEqual([baselineLayer]);
        await expect(sizes.screen.getByTestId('layers-1')).toHaveCount(0);
        await expect(sizes.screen.getByRole('button', { name: 'Удалить слой 1', exact: true })).toHaveCount(0);
        await save(() => sizes.layerSection().getByRole('button', { name: '+ Добавить слой', exact: true }).click());
        await expect(sizes.screen.getByTestId('layers-1')).toBeVisible();
        await save(() => commitField(sizes.layerField('X', 2), '3'));
        await save(() => commitField(sizes.layerField('Y', 2), '9'));
        expect(await shadow()).toMatchObject({ layers: [baselineLayer, addedLayer], platforms: {} });
        await expect(sizes.shadowPreview('down.hard.m')).toHaveCSS('box-shadow', / 3px 9px 4px 0px$/u);
        await sizes.reload();
        await sizes.select('shadow', id);
        await expect(sizes.layerField('X', 2)).toHaveValue('3');
        await expect(sizes.layerField('Y', 2)).toHaveValue('9');
        await save(() =>
            sizes.screen.getByTestId('layers-0').getByRole('button', { name: 'Удалить слой 1', exact: true }).click(),
        );
        const remaining = await shadow();
        expect(remaining).toMatchObject({
            layers: [addedLayer],
            native: { ios: { layers: [addedLayer] }, android: { layers: [addedLayer] } },
        });
        await expect(sizes.screen.getByTestId('layers-1')).toHaveCount(0);
        await expect(sizes.layerField('X')).toHaveValue('3');
        await expect(sizes.layerField('Y')).toHaveValue('9');
        await expect(sizes.screen.getByRole('button', { name: 'Удалить слой 1', exact: true })).toHaveCount(0);
        await expect(sizes.shadowPreview('down.hard.m')).toHaveCSS('box-shadow', / 3px 9px 4px 0px$/u);
        const after = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        expect(after.filter((value) => value.tokenId !== id)).toEqual(before.filter((value) => value.tokenId !== id));
        const rows = after.filter((value) => value.tokenId === id);
        expect(rows).toHaveLength(3);
        expect(rows.find((value) => value.platform === 'web')?.value).toEqual([
            '0.1875rem 0.5625rem 0.25rem 0rem #0000001F',
        ]);
        expect(rows.find((value) => value.platform === 'ios')?.value).toEqual([
            { color: '#0000001F', offsetX: 3, offsetY: 9, blurRadius: 4, spreadRadius: 0 },
        ]);
        expect(rows.find((value) => value.platform === 'android')?.value).toEqual([
            { color: '#0000001F', offsetX: 3, offsetY: 9, blurRadius: 4, spreadRadius: 0, fallbackElevation: 0 },
        ]);
        await sizes.reload();
        await sizes.select('shadow', id);
        expect(await shadow()).toEqual(remaining);
        await expect(sizes.layerField('Y')).toHaveValue('9');
    },
);

test(
    'PLASMABLDR-T754: RSS-020 Собственные слои iOS для тени',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T754' } },
    async ({ sizes, sizeData, tokenValues, initialTheme, setupSession, pendingMutation }) => {
        const id = sizeData.shadow.id;
        const url = tokenValues.sizeURL(initialTheme.id, id);
        const before = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        const shadow = async () => {
            const matches = (await readSizeView(tokenValues, initialTheme.id, setupSession)).shadows.filter(
                (token) => token.tokenId === id,
            );
            expect(matches).toHaveLength(1);
            return matches[0]!;
        };
        const save = (action: () => Promise<unknown>) => saveSize(sizes, pendingMutation, url, action);
        await sizes.open();
        await sizes.select('shadow', id);
        await save(() => sizes.addPlatform('iOS', true));
        await expect(sizes.screen.getByTestId('override-layers-ios')).toBeVisible();
        expect(
            (await tokenValues.values(initialTheme.id, 'shadow')).find(
                (value) => value.tokenId === id && value.platform === 'ios',
            ),
        ).toMatchObject({ overridden: true });
        await save(() => commitField(sizes.layerField('Y', 1, 'iOS'), '17'));
        const own = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        expect(own.filter((value) => value.tokenId !== id || value.platform !== 'ios')).toEqual(
            before.filter((value) => value.tokenId !== id || value.platform !== 'ios'),
        );
        await save(() => commitField(sizes.layerField('Y'), '12'));
        const ownLayer = { ...baselineLayer, offsetY: 17 };
        const webLayer = { ...baselineLayer, offsetY: 12 };
        expect(await shadow()).toMatchObject({
            layers: [webLayer],
            platforms: { ios: { layers: [ownLayer] } },
            native: { ios: { layers: [ownLayer] }, android: { layers: [webLayer] } },
        });
        const afterWeb = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        expect(afterWeb.filter((value) => value.tokenId === id && value.platform === 'ios')).toEqual(
            own.filter((value) => value.tokenId === id && value.platform === 'ios'),
        );
        expect(afterWeb.filter((value) => value.tokenId !== id)).toEqual(
            before.filter((value) => value.tokenId !== id),
        );
        await sizes.reload();
        await sizes.select('shadow', id);
        await expect(sizes.layerField('Y')).toHaveValue('12');
        await expect(sizes.layerField('Y', 1, 'iOS')).toHaveValue('17');
        await save(() => sizes.screen.getByRole('button', { name: 'Убрать свои слои iOS', exact: true }).click());
        await expect(sizes.screen.getByTestId('override-layers-ios')).toHaveCount(0);
        expect(await shadow()).toMatchObject({
            layers: [webLayer],
            platforms: {},
            native: { ios: { layers: [webLayer] }, android: { layers: [webLayer] } },
        });
        const after = await tokenValues.values(initialTheme.id, 'shape,spacing,shadow');
        expect(after.find((value) => value.tokenId === id && value.platform === 'ios')).toMatchObject({
            overridden: false,
        });
        expect(after.filter((value) => value.tokenId !== id)).toEqual(before.filter((value) => value.tokenId !== id));
        await sizes.reload();
        await sizes.select('shadow', id);
        await expect(sizes.screen.getByTestId('override-layers-ios')).toHaveCount(0);
        await expect(sizes.layerField('Y')).toHaveValue('12');
    },
);
