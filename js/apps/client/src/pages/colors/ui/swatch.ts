import type { CSSProperties } from 'react';

import { webLayers } from '../../../modules/colorTokens';

/** Непрозрачная основа цвета с альфой (`transparentSwatchBase` прототипа) или `null` для непрозрачного. */
const transparentBase = (paint: string) => {
    if (paint.trim().toLowerCase() === 'transparent') return '#000000';
    const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/i.exec(paint.trim());
    if (!hex) return null;
    const channels = hex[1].length === 4 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return parseInt(channels.slice(6, 8), 16) < 255 ? `#${channels.slice(0, 6)}` : null;
};

/** Переменные свотча с прозрачностью (`alphaSwatchStyle` прототипа). */
export const alphaSwatchStyle = (value: string, fallback = '#2b3038'): CSSProperties => {
    const paint = value.trim() || fallback;
    const solid = transparentBase(paint);
    return {
        '--swatch-color': paint,
        '--swatch-solid': solid ?? paint,
        '--swatch-alpha-preview': solid ? 1 : 0,
    } as CSSProperties;
};

const GRADIENT = /gradient\(/i;

/** Слои половины чипа: цвет — однотонный слой, градиент — его слои; каждый занимает свою половину. */
const halfLayers = (paint: string, side: 'top' | 'bottom') =>
    (GRADIENT.test(paint) ? webLayers(paint) : [paint || 'transparent'])
        .map(
            (layer) =>
                `${GRADIENT.test(layer) ? layer : `linear-gradient(${layer}, ${layer})`} ${side} / 100% 50% no-repeat`,
        )
        .join(', ');

/**
 * Чип строки дерева: верхняя половина — Light, нижняя — Dark (`linkedColorTokenTree`). Половина с градиентом
 * заливается этим градиентом.
 */
export const rowPreview = (light: string, dark: string) => {
    if (GRADIENT.test(light) || GRADIENT.test(dark))
        return `${halfLayers(light, 'top')}, ${halfLayers(dark, 'bottom')}`;
    return dark && dark !== light ? `linear-gradient(180deg, ${light} 0 50%, ${dark} 50% 100%)` : light;
};

/** Шахматка под прозрачным цветом: светлые и серые клетки 4 px. */
const CHECKER = 'conic-gradient(#f3f5f7 25%, #aeb5bf 0 50%, #f3f5f7 0 75%, #aeb5bf 0) 0 0 / 8px 8px';

/**
 * Заливка половины плитки борда: цвет или слои градиента поверх шахматки по всей площади половины. Непрозрачный
 * цвет шахматку закрывает, прозрачный показывает её целиком, без деления на непрозрачную и прозрачную части.
 */
export const checkerFill = (paint: string): CSSProperties => {
    const value = paint.trim() || 'transparent';
    const layers = GRADIENT.test(value) ? webLayers(value) : [`linear-gradient(${value}, ${value})`];
    return { '--swatch-color': value, background: [...layers, CHECKER].join(', ') } as CSSProperties;
};

const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((index) => {
        const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const TILE_LABEL_DARK = '#56585c';
const TILE_LABEL_LIGHT = '#dbdbdc';

/**
 * Цвет подписи половины плитки (`ColorToken/WorkspaceSample`): #56585c на светлом цвете, #dbdbdc на тёмном —
 * какой из двух контрастнее с цветом половины.
 */
export const tileLabelColor = (background: string) => {
    if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(background)) return TILE_LABEL_LIGHT;
    const contrast = (label: string) => {
        const [a, b] = [luminance(background), luminance(label)].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
    };
    return contrast(TILE_LABEL_DARK) > contrast(TILE_LABEL_LIGHT) ? TILE_LABEL_DARK : TILE_LABEL_LIGHT;
};
