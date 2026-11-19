import { test as base, expect } from './palette.ts';
import { paletteGroup } from '../helpers/palette.api.ts';
import { exactValue } from '../helpers/color-data.ts';
import type { ThemePalette } from '../helpers/palette.api.ts';

/** Подготовка полностью завершена до UI; публикация исключает её из проверяемого журнала. */
export const test = base.extend<{ linkedPaletteBaseline: ThemePalette; translucentPalette: ThemePalette }>({
    linkedPaletteBaseline: [
        async ({ linkedColor, paletteApi, versionsApi }, use) => {
            void linkedColor;
            const palette = await paletteApi.get();
            paletteGroup(palette, 'accent');
            await versionsApi.publish('0.1.0', 'Palette dependencies baseline');
            expect(await versionsApi.changes()).toEqual([]);
            // Publication resets technical revisions; capture the baseline afterwards.
            await use(await paletteApi.get());
        },
        { timeout: 120_000 },
    ],
    translucentPalette: [
        async ({ linkedColor, tokenValues, initialTheme, colorData, paletteApi }, use) => {
            void linkedColor;
            const current = exactValue(
                await tokenValues.values(initialTheme.id, 'color'),
                colorData.accent.id,
                'light',
            );
            await tokenValues.seed(initialTheme.id, [{ current, value: '[additional.h130.500][0.8]' }]);
            await use(await paletteApi.get());
        },
        { timeout: 120_000 },
    ],
});
export { expect };
