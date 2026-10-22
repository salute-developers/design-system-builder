import type { CSSProperties } from 'react';

import { webLayers } from '../../../modules/colorTokens';
import { swatchLabelColor } from '../../../modules/palette';

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

/** Подпись половины свотча на борде: чёрная или белая по большему контрасту (`paletteSwatchLabelStyle`). */
export const swatchLabel = (background: string) => {
    const hex = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(background) ? background : '#202327';
    const color = swatchLabelColor(hex);
    return { color, className: color === '#000000' ? 'is-label-dark' : 'is-label-light' };
};
