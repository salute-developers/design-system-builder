import { expect } from '@playwright/test';
import { PaletteApi, paletteGroup, paletteRamp, green } from './palette.api.ts';
import { exactDefinition } from './color-data.ts';
import type { TokenValuesApi } from './token-values.api.ts';

export const viewerPaletteHex = '#197844';

/** Данные выбранной палитры и семантической ссылки, без посторонних токенов проекта. */
export async function readViewerPalette(
    paletteApi: PaletteApi,
    tokenValues: TokenValuesApi,
    themeId: string,
    tokenId: string,
) {
    const palette = await paletteApi.get();
    const accent = paletteGroup(palette, 'accent');
    const values = (await tokenValues.values(themeId, 'color')).filter((value) => value.tokenId === tokenId);
    expect(values).toHaveLength(6);
    return {
        editRevision: palette.editRevision,
        groups: palette.groups.map(({ id, label, ramps }) => ({ id, label, slots: ramps.map(({ slot }) => slot) })),
        ramp: paletteRamp(accent, green),
        values: values
            .map(({ platform, mode, value, editRevision, overridden }) => ({
                platform,
                mode,
                value,
                editRevision,
                overridden,
            }))
            .sort((a, b) => (a.platform + a.mode).localeCompare(b.platform + b.mode)),
    };
}

/** Отдельная тема, ступень с отличимым HEX и настоящая ссылка textAccent Light. */
export async function prepareViewerPalette(paletteApi: PaletteApi, api: TokenValuesApi, themeId: string) {
    const prepared = await paletteApi.prepare();
    const accent = paletteGroup(prepared, 'accent');
    await paletteApi.seedStep(accent.id, green, 500, viewerPaletteHex);
    const token = exactDefinition(await api.definitions(), 'text.default.accent');
    const light = (await api.values(themeId, 'color')).filter(
        (value) => value.tokenId === token.id && value.mode === 'light',
    );
    expect(light.map((value) => value.platform).sort()).toEqual(['android', 'ios', 'web']);
    await api.seed(
        themeId,
        light.map((current) => ({ current, value: '[additional.h130.500]' })),
    );
    const baseline = await readViewerPalette(paletteApi, api, themeId, token.id);
    expect(baseline.ramp.steps.filter((step) => step.step === 500)).toEqual([
        expect.objectContaining({ value: viewerPaletteHex, overridden: true }),
    ]);
    return { accent, neutral: paletteGroup(prepared, 'neutral'), token, baseline };
}
