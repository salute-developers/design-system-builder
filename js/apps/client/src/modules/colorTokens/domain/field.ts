import { parsePaletteReference, templateRampName } from '../../palette';
import type { ColorFieldValue, ColorTokenType } from './types';

/** Вычисление цвета ссылки по палитре темы: HEX с альфой или `null`, если ступени нет. */
export type PaletteColorResolver = (value: string, tokenName: string) => string | null;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Строковое значение платформы: ссылка, HEX или слои градиента через запятую. */
export const rawValue = (value: unknown): string => {
    if (Array.isArray(value)) return value.map(String).join(', ');
    return value === undefined || value === null ? '' : String(value);
};

const hexOpacity = (hex: string) => {
    const digits = hex.replace('#', '');
    if (digits.length !== 8) return 1;
    return Math.round((parseInt(digits.slice(6), 16) / 255) * 100) / 100;
};

/** Поле значения для инспектора и чипов: метка ступени палитры, прозрачность и цвет отображения. */
export const colorField = (
    value: unknown,
    type: ColorTokenType,
    tokenName: string,
    resolve: PaletteColorResolver,
): ColorFieldValue => {
    const raw = rawValue(value);
    if (type === 'gradient') return { value: raw, resolved: raw, paletteLabel: null, opacity: 1 };
    const reference = parsePaletteReference(raw);
    if (reference) {
        return {
            value: raw,
            resolved: resolve(raw, tokenName) ?? 'transparent',
            paletteLabel: `${templateRampName(reference)} ${reference.step}`,
            opacity: reference.opacity ?? 1,
        };
    }
    return { value: raw, resolved: HEX.test(raw) ? raw : 'transparent', paletteLabel: null, opacity: hexOpacity(raw) };
};

/** Совпадают ли два значения поля для признака связи подтемы. */
export const sameValue = (a: ColorFieldValue, b: ColorFieldValue) =>
    a.value.replace(/\s+/g, '').toLowerCase() === b.value.replace(/\s+/g, '').toLowerCase();
