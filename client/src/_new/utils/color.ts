import { ContrastRatioChecker } from 'contrast-ratio-checker';
import { general as generalColors } from '@salutejs/plasma-colors';
import {
    Grayscale,
    type ThemeMode,
    extractColors,
    getHEXAColor,
    getHSLARawColor,
    getRestoredColorFromPalette,
} from '@salutejs/plasma-tokens-utils';
import type { PlasmaSaturation } from '@salutejs/plasma-colors';

import type { ComplexValue, FormulaMode, GeneralColor, GetGreyTokenDataParams, OperationKind } from '../types';
import { formulas } from './formulas';
import { inRange } from './other';

export { getHEXAColor, getHSLARawColor };

const DEFAULT_WHITE_COLOR = '#FFFFFFFF';
const DEFAULT_BLACK_COLOR = '#000000FF';
const excludeColors = [DEFAULT_WHITE_COLOR, DEFAULT_BLACK_COLOR];

const isValidColorValue = (value: string) => /((rgba?|hsla?)\([\d.%\s,()#\w]*\))|(#\w{6,8})/m.test(value);

export const getPaletteColorByHEX = (inputColor: string) => {
    const hexInputColor = getHEXAColor(inputColor);

    for (const [shade, saturations] of Object.entries(generalColors)) {
        for (const [saturation, color] of Object.entries(saturations)) {
            const hexPaletteColor = getHEXAColor(color);

            if (!excludeColors.includes(hexInputColor) && hexInputColor === hexPaletteColor) {
                return [shade, saturation] as unknown as [GeneralColor, PlasmaSaturation];
            }
        }
    }

    return [undefined, undefined];
};

export const getPaletteColorByValue = (value: ComplexValue) => {
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        const [, color] = extractColors(value);
        const [, shade, saturation] = color.split('.');

        return [shade, saturation] as unknown as [GeneralColor, PlasmaSaturation];
    }

    return [undefined, undefined];
};

export const normalizeValue = (value: ComplexValue) => {
    if (typeof value === 'string' && !value.includes('gradient')) {
        const newValue = getRestoredColorFromPalette(value);

        if (!isValidColorValue(newValue)) {
            return DEFAULT_WHITE_COLOR;
        }

        return newValue;
    }

    return DEFAULT_WHITE_COLOR;
};

export const getBackgroundColor = (value: ComplexValue) => {
    if (Array.isArray(value)) {
        return value.map((val) => val.origin).join(', ');
    }

    if (typeof value === 'object') {
        return value.origin;
    }

    const newValue = getRestoredColorFromPalette(value);

    if (!isValidColorValue(newValue)) {
        return DEFAULT_WHITE_COLOR;
    }

    return newValue;
};

const hexAToRGBA = (hex: string) => [
    Number(`0x${hex[1]}${hex[2]}`),
    Number(`0x${hex[3]}${hex[4]}`),
    Number(`0x${hex[5]}${hex[6]}`),
    hex[7] && hex[8] ? Number(`0x${hex[7]}${hex[8]}`) : 255,
];

export const getRGBAColor = (color: string) => {
    const hex = getHEXAColor(color);
    const [r, g, b, a] = hexAToRGBA(hex);
    return `rgba(${r}, ${g}, ${b}, ${Number(a / 255).toFixed(2)})`;
};

export const getSwiftUIColor = (color: string | undefined) => {
    if (!color) {
        return '';
    }

    const hexColor = getHEXAColor(color);
    const colors = hexAToRGBA(hexColor);
    const [red, green, blue, alpha] = colors.map((value) => Number((value / 255).toFixed(3)));

    return `UIColor(red: ${red}, green: ${green}, blue: ${blue}, alpha: ${alpha})`;
};

export const getAndroidColor = (color: string) => {
    const hexColor = getHEXAColor(color);
    const hex = hexColor.slice(1, 7);
    const alfa = hexColor.length === 9 ? `${hexColor.slice(7)}` : 'FF';

    return `#${alfa}${hex}`;
};

export const getGreyTokenData = ({ saturation, grayscale, opacity }: GetGreyTokenDataParams) => {
    return opacity
        ? `[general.${grayscale}.${saturation}][${(opacity - 1).toPrecision(3)}]`
        : `[general.${grayscale}.${saturation}]`;
};

export const getGrayscale = (): Array<{
    value: Grayscale;
    label: string;
}> => [
    {
        value: Grayscale.gray,
        label: Grayscale.gray,
    },
    {
        value: Grayscale.coolGray,
        label: Grayscale.coolGray,
    },
];

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

        if (!newAlpha) {
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

        if (!newLightness) {
            return '#FFFFFFFF';
        }

        return hsl.lightness(newLightness).round().hexa();
    };
};

export const getStateColor = (color: string, type: FormulaMode, mode: ThemeMode) => {
    const hsl = getHSLARawColor(color);

    return hsl.alpha() === 1 ? getSolidColor(color, type, mode) : getTransparentColor(color, type, mode);
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

export const checkIsColorContrast = (firstColor?: string, secondColor?: string, threshold = 2) => {
    const checker = new ContrastRatioChecker();

    const first = firstColor?.length === 9 ? firstColor.slice(0, -2) : firstColor;
    const second = secondColor?.length === 9 ? secondColor.slice(0, -2) : secondColor;

    let contrastRatio = 0;

    try {
        contrastRatio = checker.getContrastRatioByHex(first || '#FFFFFF', second || '#000000');
    } catch (e) {
        // console.warn(e);
    }

    const ratio = Math.round(contrastRatio * 100) / 100;

    return ratio > threshold;
};

export type ColorFormats = {
    hex: string;
    rgb: string;
    hsl: string;
};

export const convertColor = (input: string): ColorFormats => {
    const el = document.createElement('div');
    el.style.color = input.trim();
    document.body.appendChild(el);

    const computed = getComputedStyle(el).color; // <-- всегда "rgb()" или "rgba()"
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
    const [l, h, s] = hsla.color.map(Math.round);
    const hsl = a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${a})` : `hsl(${h}, ${s}%, ${l}%)`;

    return { hex, rgb, hsl };
};

export const getColorAndOpacity = (value: string) => {
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
    const color = hex.slice(0, -2);

    return [color, opacity] as const;
};

export const getCorpColor = (accentValue: string, saturationValue: string) =>
    `general.${accentValue}.${saturationValue}`;

export const separatedCorpColor = (value?: string) =>
    value ? (value.split('.').length === 3 ? value.split('.') : ['', '', '']) : '';
