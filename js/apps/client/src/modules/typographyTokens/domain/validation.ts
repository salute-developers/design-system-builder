import { definedEntries } from './style';
import type { TypographyField, TypographyStyleChange } from './types';

/** Тексты ошибок прототипа SDDS Portal; правило веса — шаг 100, как на сервере. */
export const TYPOGRAPHY_MESSAGES = {
    size: 'Размер и межстрочный интервал должны быть положительными числами.',
    letterSpacing: 'Letter spacing должен быть в диапазоне от -0.2em до 1em.',
    weight: 'Вес шрифта должен быть числом от 100 до 900 с шагом 100.',
} as const;

/** Первое нарушение правил значения стиля: поле и текст; `null` — правка допустима. */
export const validateChange = (change: TypographyStyleChange): { field: TypographyField; message: string } | null => {
    if (change.size !== undefined && !(change.size > 0)) return { field: 'size', message: TYPOGRAPHY_MESSAGES.size };
    if (change.lineHeight !== undefined && !(change.lineHeight > 0))
        return { field: 'lineHeight', message: TYPOGRAPHY_MESSAGES.size };
    if (change.letterSpacing !== undefined && !(change.letterSpacing >= -0.2 && change.letterSpacing <= 1))
        return { field: 'letterSpacing', message: TYPOGRAPHY_MESSAGES.letterSpacing };
    const weight = definedEntries(change.weights).find(
        ([, value]) => !Number.isInteger(value) || value < 100 || value > 900 || value % 100 !== 0,
    );
    if (weight) return { field: `weights.${weight[0]}`, message: TYPOGRAPHY_MESSAGES.weight };
    return null;
};
