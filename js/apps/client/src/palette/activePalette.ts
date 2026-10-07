// eslint-disable-next-line no-restricted-imports -- единственная точка, где ссылка на палитру раскрывается встроенной палитрой
import { alphenColor, getRestoredColorFromPalette } from '@salutejs/plasma-tokens-utils';

import { resolvePaletteStep, type ThemePalette } from '../modules/palette';

/**
 * Палитра открытой темы для отображения цветов токенов. Без активной палитры или без найденной ступени
 * ссылка раскрывается встроенной палитрой, как раньше.
 */
let activePalette: ThemePalette | null = null;
const listeners = new Set<() => void>();

export const setActivePalette = (palette: ThemePalette | null) => {
    activePalette = palette;
    listeners.forEach((listener) => listener());
};

export const getActivePalette = () => activePalette;

export const subscribeActivePalette = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/**
 * Замена `getRestoredColorFromPalette` с той же семантикой прозрачности: итоговая альфа равна
 * `1 + opacity + alphaSign`, поэтому при `alphaSign = -1` прозрачность ссылки абсолютная.
 */
export const restorePaletteColor = (value: string, alphaSign: 0 | -1 = 0, tokenName?: string): string => {
    if (activePalette) {
        const resolved = resolvePaletteStep(activePalette, value, tokenName);
        if (resolved)
            return resolved.opacity === null
                ? resolved.hex
                : alphenColor(resolved.hex, resolved.opacity + alphaSign, 'hexa', true);
    }
    return getRestoredColorFromPalette(value, alphaSign);
};

/** Значение ступени встроенной палитры без учёта палитры темы — для снятия шаблона режима `local`. */
export const restoreTemplateColor = (type: string, shade: string, step: string) =>
    getRestoredColorFromPalette(`[${type}.${shade}.${step}]`);
