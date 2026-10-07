import { afterEach, describe, expect, it } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- эталон прежнего поведения
import { getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import golden from '../modules/palette/fixtures/palette-golden.json';
import { buildThemePalette, type PaletteState, type PaletteTokenRef, type PaletteTokenValue } from '../modules/palette';
import { getNormalizedColor } from '../utils/color';
import { restorePaletteColor, setActivePalette } from './activePalette';

const palette = () =>
    buildThemePalette({
        tenantId: 't',
        canEdit: true,
        state: JSON.parse(JSON.stringify(golden.scenario.state)) as PaletteState,
        tokens: golden.scenario.tokens as PaletteTokenRef[],
        values: golden.scenario.values as PaletteTokenValue[],
    }).palette;

describe('restorePaletteColor', () => {
    afterEach(() => setActivePalette(null));

    it('без палитры совпадает с getRestoredColorFromPalette', () => {
        for (const value of ['[general.green.500]', '[general.green.400][0.5]', '#123456'])
            for (const sign of [0, -1] as const)
                expect(restorePaletteColor(value, sign)).toBe(getRestoredColorFromPalette(value, sign));
    });

    it('с палитрой берёт значение из группы токена', () => {
        setActivePalette(palette());
        expect(restorePaletteColor('[general.green.500]', -1, 'light.text.default.accent')).toBe(
            golden.template['additional.h190']['500'],
        );
        expect(restorePaletteColor('[general.green.500]', -1, 'light.text.default.primary')).toBe(
            golden.template['general.green']['500'],
        );
    });

    it('превью редактора токена (getNormalizedColor) разрешает ссылку по группе токена', () => {
        setActivePalette(palette());
        expect(getNormalizedColor('general.green.500', undefined, false, 'light.text.default.accent')).toBe(
            golden.template['additional.h190']['500'],
        );
        expect(getNormalizedColor('general.green.500')).toBe(golden.template['general.green']['500']);
    });

    it('прозрачность повторяет библиотеку: абсолютная при alphaSign = -1, непрозрачная при 0', () => {
        setActivePalette(palette());
        const hex = golden.template['additional.h190']['400'];
        expect(restorePaletteColor('[general.green.400][0.5]', -1, 'dark.text.default.accent').toUpperCase()).toBe(`${hex}80`);
        expect(restorePaletteColor('[general.green.400][0.5]', 0, 'dark.text.default.accent').toUpperCase()).toBe(`${hex}FF`);
        expect(getRestoredColorFromPalette('[general.green.400][0.5]', 0).toUpperCase()).toMatch(/FF$/);
    });

    it('неизвестная ступень откатывается к встроенной палитре', () => {
        setActivePalette(palette());
        expect(restorePaletteColor('[general.red.500]', -1)).toBe(getRestoredColorFromPalette('[general.red.500]', -1));
    });
});
