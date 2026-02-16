import { ContrastRatioChecker } from 'contrast-ratio-checker';
import { general as generalColors } from '@salutejs/plasma-colors';
import {
    type ThemeMode,
    extractColors,
    getHEXAColor,
    getHSLARawColor,
    getRestoredColorFromPalette,
} from '@salutejs/plasma-tokens-utils';
import type { PlasmaSaturation } from '@salutejs/plasma-colors';

import type { ColorFormats, ComplexValue, FormulaMode, GeneralColor, OperationKind } from '../types';
import { formulas } from './formulas';
import { inRange, roundTo } from './other';

export { getHEXAColor, getHSLARawColor };

const checker = new ContrastRatioChecker();

// const excludeColors = [DEFAULT_WHITE_COLOR, DEFAULT_BLACK_COLOR];

export const isValidColorValue = (value: string): boolean => {
    const trimmed = value.trim().toLowerCase();

    const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
    const rgbPattern = /^rgb\(\s*(\d{1,3}%?\s*,\s*){2}\d{1,3}%?\s*\)$/i;
    const hslPattern = /^hsl\(\s*\d{1,3}(\.\d+)?\s*,\s*\d{1,3}(\.\d+)?%\s*,\s*\d{1,3}(\.\d+)?%\s*\)$/i;

    return hexPattern.test(trimmed) || rgbPattern.test(trimmed) || hslPattern.test(trimmed);
};

export type ColorFormat = 'hex' | 'rgb' | 'hsl';

export const detectColorFormat = (color: string): ColorFormat => {
    const trimmed = color.trim().toLowerCase();

    if (trimmed.startsWith('#')) {
        return 'hex';
    }

    if (trimmed.startsWith('rgb')) {
        return 'rgb';
    }

    if (trimmed.startsWith('hsl')) {
        return 'hsl';
    }

    return 'hex';
};

// export const getPaletteColorByHEX = (inputColor: string) => {
//     const hexInputColor = getHEXAColor(inputColor);

//     for (const [shade, saturations] of Object.entries(generalColors)) {
//         for (const [saturation, color] of Object.entries(saturations)) {
//             const hexPaletteColor = getHEXAColor(color);

//             if (!excludeColors.includes(hexInputColor) && hexInputColor === hexPaletteColor) {
//                 return [shade, saturation] as unknown as [GeneralColor, PlasmaSaturation];
//             }
//         }
//     }

//     return [undefined, undefined];
// };

/**
 * Метод возвращает цвет в формате [general.shade.saturation] с обновлённым значением светлости.
 * @example value:`[general.red.500]`, saturation: `150` => `[general.red.150]`
 */
export const updateColorSaturation = (value: string, saturation: PlasmaSaturation) => {
    const [palette, shade] = value.replace(/\[|\]/g, '').split('.');

    return `[${palette}.${shade}.${saturation}]`;
};

export const getTransparentColor = (color: string, type: FormulaMode, mode: ThemeMode) => {
    const hsl = getHSLARawColor(color);
    const a = hsl.alpha();

    const result = formulas[type].transparent[mode].find(({ condition }) => {
        const { alpha } = condition;

        return inRange(a, alpha);
    });

    return (state: OperationKind) => {
        if (!result) {
            return '#FFFFFFFF';
        }

        const newAlpha = result.operation[state]?.(a);

        if (newAlpha === undefined) {
            return '#FFFFFFFF';
        }

        return hsl.alpha(newAlpha).round().hexa();
    };
};

export const getSolidColor = (color: string, type: FormulaMode, mode: ThemeMode) => {
    const hsl = getHSLARawColor(color);
    const l = hsl.lightness();
    const h = hsl.hue();
    const s = hsl.saturationl();

    const result = formulas[type].solid[mode].find(({ condition }) => {
        const { lightness, hue, saturation } = condition;

        return inRange(l, lightness) && inRange(h, hue) && inRange(s, saturation);
    });

    return (state: OperationKind) => {
        if (!result) {
            return '#FFFFFFFF';
        }

        const newLightness = result.operation[state]?.(l);

        if (newLightness === undefined) {
            return '#FFFFFFFF';
        }

        return hsl.lightness(newLightness).round().hexa();
    };
};

export const getStateColor = (color: string, type: FormulaMode, mode: ThemeMode) => {
    const hsl = getHSLARawColor(color);

    return hsl.alpha() === 1 ? getSolidColor(color, type, mode) : getTransparentColor(color, type, mode);
};

export const getPaletteColorByValue = (value: ComplexValue) => {
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        const [, color] = extractColors(value);
        const [, shade, saturation] = color.split('.');

        return [shade, saturation] as unknown as [GeneralColor, PlasmaSaturation];
    }

    return [undefined, undefined];
};

export const getNormalizedColor = (color: string, opacity?: number, preserveFormat?: boolean) => {
    if (color.startsWith('general.')) {
        const value = opacity !== undefined ? `[${color}][${opacity}]` : `[${color}]`;
        return getRestoredColorFromPalette(value, -1);
    }

    const baseHex = getHEXAColor(color).slice(0, 7);
    const alphaHex = opacity !== undefined && opacity < 1 ? getAlphaHex(opacity) : '';
    const finalHex = baseHex + alphaHex;

    if (!preserveFormat) {
        return finalHex;
    }

    return convertColor(finalHex)[detectColorFormat(color)];
};

export const shiftAccentColor = (color: ComplexValue, theme: ThemeMode, opacity?: number) => {
    const [min, max] = theme === 'dark' ? [150, 700] : [400, 800];
    const shiftDirection = theme === 'dark' ? -1 : 1;
    const [shade, saturation] = getPaletteColorByValue(color);

    if (!shade || !saturation) {
        return '#FFFFFF';
    }

    const shades = Object.keys(generalColors[shade]) as unknown as PlasmaSaturation[];
    const colorIndex = shades.findIndex((item) => item === saturation);
    const newSaturation = Number(shades[colorIndex + shiftDirection]);

    const newValue = `[general.${shade}.${Math.min(max, Math.max(min, newSaturation))}]`;

    // TODO: удалить opacity - 1 и обновить использование метода в новой архитектуре
    return opacity ? `${newValue}[${(opacity - 1).toPrecision(2)}]` : newValue;
};

export const checkIsColorContrast = (color?: string, background?: string, threshold = 2) => {
    try {
        return getContrastRatio(color, background) > threshold;
    } catch {
        return 0;
    }
};

export const getContrastRatio = (color?: string, background?: string) => {
    const colorHex = getHEXAColor(color || '#FFFFFF');
    const backgroundHex = getHEXAColor(background || '#000000');

    const first = colorHex?.length === 9 ? colorHex.slice(0, -2) : colorHex;
    const second = backgroundHex?.length === 9 ? backgroundHex.slice(0, -2) : backgroundHex;

    return Number(roundTo(checker.getContrastRatioByHex(first, second), 2));
};

export const convertColor = (input: string): ColorFormats => {
    const el = document.createElement('div');
    el.style.color = input.trim();
    document.body.appendChild(el);

    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);

    const rgbMatch = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

    if (!rgbMatch) {
        throw new Error(`Unable to parse color: "${input}"`);
    }

    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    const rgb = a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;

    const toHex = (x: number) => x.toString(16).toUpperCase().padStart(2, '0');
    const hex = '#' + toHex(r) + toHex(g) + toHex(b) + (a < 1 ? toHex(Math.round(a * 255)) : '');

    const hsla = getHSLARawColor(rgb);
    const [h, s, l] = hsla.color.map(Math.round);
    const hsl = a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${a})` : `hsl(${h}, ${s}%, ${l}%)`;

    return { hex, rgb, hsl };
};

export const getColorAndOpacity = (value: string | string[]) => {
    const extractAlphaFromHex = (hex: string) => {
        hex = hex.replace('#', '').trim();

        if (hex.length === 8) {
            const alpha = parseInt(hex.slice(-2), 16);
            return Number((alpha / 255).toFixed(2));
        }

        return 1;
    };

    if (!value || Array.isArray(value)) {
        return ['#FFFFFF', 1] as const;
    }

    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        const [, color, opacity] = extractColors(value);
        return [color, Number(opacity ?? 1)] as const;
    }

    const hex = value.startsWith('#') ? value : getHEXAColor(value);
    const opacity = extractAlphaFromHex(hex);
    const color = opacity < 1 ? hex.slice(0, -2) : hex;

    return [color, opacity] as const;
};

export const getCorpColor = (accentValue: string, saturationValue: string) =>
    `general.${accentValue}.${saturationValue}`;

export const separatedCorpColor = (value?: string) =>
    value ? (value.split('.').length === 3 ? value.split('.') : ['', '', '']) : '';

export const getAlphaHex = (opacity?: number) =>
    opacity !== undefined
        ? Math.round(opacity * 255)
              .toString(16)
              .padStart(2, '0')
              .toUpperCase()
        : undefined;
