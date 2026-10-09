import { hexToRgba, hslToRgb, rgbaToHex, rgbToHsl } from './color';

/**
 * Перестройка растяжки от опорного цвета — перенос `sourcePaletteRebuildValues` прототипа.
 * Опорная ступень получает тон и насыщенность выбранного цвета, остальные — сдвиг тона и
 * отношение насыщенностей; светлота каждой ступени остаётся из источника.
 */
export const rebuildRamp = (source: Record<string, string>, anchorStep: number, anchorHex: string) => {
    const picked = hexToRgba(anchorHex);
    const referenceHex = source[String(anchorStep)];
    if (!picked || !referenceHex) return null;
    const pickedHsl = rgbToHsl(picked);
    const reference = rgbToHsl(hexToRgba(referenceHex)!);
    const hueShift = pickedHsl.h - reference.h;
    const saturationRatio = reference.s >= 3 ? pickedHsl.s / Math.max(reference.s, 1) : null;
    const result: Record<string, string> = {};

    for (const [step, baseHex] of Object.entries(source)) {
        const base = rgbToHsl(hexToRgba(baseHex)!);
        const isAnchor = step === String(anchorStep);
        const h = isAnchor ? pickedHsl.h : (((base.h + hueShift) % 360) + 360) % 360;
        const s = isAnchor
            ? pickedHsl.s
            : Math.max(
                  0,
                  Math.min(100, Math.round(saturationRatio === null ? pickedHsl.s : base.s * saturationRatio)),
              );
        result[step] = rgbaToHex({ ...hslToRgb({ h, s, l: base.l }), a: 1 }).toUpperCase();
    }
    return result;
};

/** Опорная ступень по умолчанию: `500`, иначе средняя ступень источника. */
export const defaultAnchorStep = (steps: number[]) => {
    if (steps.includes(500)) return 500;
    const sorted = [...steps].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};
