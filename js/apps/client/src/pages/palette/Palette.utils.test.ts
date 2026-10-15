import { describe, expect, it } from 'vitest';

import type { PaletteRamp } from '../../modules/palette';
import { changedSteps } from './Palette.utils';

const step = (value: number, overridden = false) => ({
    step: value,
    value: '#000000',
    templateValue: '#000000',
    overridden,
    linkedCount: 0,
});

const ramp = (patch: Partial<PaletteRamp>): PaletteRamp => ({
    slot: { type: 'general', shade: 'green' },
    source: { type: 'general', shade: 'green' },
    displayName: 'Green',
    origin: 'template',
    anchor: null,
    added: false,
    modified: false,
    linkedCount: 0,
    steps: [step(400), step(500, true), step(600)],
    ...patch,
});

describe('changedSteps', () => {
    it('у растяжки с правками — только правленые ступени', () => {
        expect(changedSteps(ramp({ modified: true })).map((item) => item.step)).toEqual([500]);
    });

    it('у заменённой или перестроенной растяжки — все ступени', () => {
        const replaced = ramp({ source: { type: 'additional', shade: 'h190' } });
        expect(changedSteps(replaced)).toHaveLength(3);
        expect(changedSteps(ramp({ origin: 'rebuild' }))).toHaveLength(3);
    });
});
