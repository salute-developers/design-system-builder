import { isGradientFunction, webLayers } from './gradient';
import type { ColorFieldValue } from './types';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Тексты проверок значения — из `validateChange` прототипа. */
export const VALUE_MESSAGES = {
    empty: 'Значение не может быть пустым.',
    color: 'Введите цвет в формате Hex: #RGB, #RRGGBB или #RRGGBBAA.',
    gradient:
        'Введите градиент в формате linear-gradient(<угол>deg, …), radial-gradient(<r>% <r>% at <x>% <y>%, …) или conic-gradient(from <угол>deg at <x>% <y>%, …).',
    native: 'Значение платформы — цвет или слои градиента формата платформы.',
    missingStep: (label: string) => `Ступени ${label} нет в палитре темы.`,
} as const;

export const isHexColor = (value: string) => HEX.test(value.trim());

/**
 * Причина, по которой значение поля или одна из его строк платформ не пройдёт проверку сервера, или `null`.
 * Значение — цвет или градиент по грамматике `ds-service`; ссылки, в том числе в стопах, должны указывать на
 * ступени палитры темы.
 */
export const validateColorValue = (field: ColorFieldValue, platform: 'web' | 'native' = 'web'): string | null => {
    if (!field.value.trim()) return VALUE_MESSAGES.empty;
    if (field.kind === null) {
        if (platform === 'native') return VALUE_MESSAGES.native;
        return webLayers(field.value).some(isGradientFunction) ? VALUE_MESSAGES.gradient : VALUE_MESSAGES.color;
    }
    if (field.missing) return VALUE_MESSAGES.missingStep(field.missing);
    return (
        Object.values(field.platforms)
            .map((row) => (row ? validateColorValue(row, 'native') : null))
            .find(Boolean) ?? null
    );
};
