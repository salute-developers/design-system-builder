import { parsePaletteReference } from '../../palette';
import { splitTopLevel } from './gradient';
import type { ColorFieldValue, ColorTokenType } from './types';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const GRADIENT = /^(?:linear|radial|conic)-gradient\(.+\)$/is;

/** Тексты проверок значения — из `validateChange` прототипа. */
export const VALUE_MESSAGES = {
    empty: 'Значение не может быть пустым.',
    color: 'Введите цвет в формате Hex: #RGB, #RRGGBB или #RRGGBBAA.',
    gradient: 'Введите градиент в формате linear-gradient(...).',
    missingStep: (label: string) => `Ступени ${label} нет в палитре темы.`,
} as const;

export const isHexColor = (value: string) => HEX.test(value.trim());

/** Причина, по которой значение не пройдёт проверку сервера, или `null`. */
export const validateColorValue = (field: ColorFieldValue, type: ColorTokenType): string | null => {
    const value = field.value.trim();
    if (!value) return VALUE_MESSAGES.empty;
    if (type === 'gradient') {
        const layers = splitTopLevel(value);
        return layers.every((layer) => GRADIENT.test(layer) || HEX.test(layer)) ? null : VALUE_MESSAGES.gradient;
    }
    if (HEX.test(value)) return null;
    if (parsePaletteReference(value)) {
        return field.resolved === 'transparent' ? VALUE_MESSAGES.missingStep(field.paletteLabel ?? value) : null;
    }
    return VALUE_MESSAGES.color;
};
