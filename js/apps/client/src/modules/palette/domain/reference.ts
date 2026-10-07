import type { PaletteRampRef, PaletteType } from './types';

export interface PaletteReference extends PaletteRampRef {
    step: number;
    opacity: number | null;
}

const REFERENCE = /^\[(general|additional)\.([A-Za-z0-9]+)\.(\d+)\](?:\[(\d+(?:\.\d+)?)\])?$/;

/** Разбирает ссылку `[type.shade.step]` с необязательной прозрачностью `[opacity]`. */
export const parsePaletteReference = (value: unknown): PaletteReference | null => {
    const raw = Array.isArray(value) && value.length === 1 ? value[0] : value;
    if (typeof raw !== 'string') return null;
    const match = REFERENCE.exec(raw.trim());
    if (!match) return null;
    const opacity = match[4] === undefined ? null : Number(match[4]);
    if (opacity !== null && (opacity < 0 || opacity > 1)) return null;
    return { type: match[1] as PaletteType, shade: match[2], step: Number(match[3]), opacity };
};

export const formatPaletteReference = ({ type, shade, step, opacity }: PaletteReference) =>
    `[${type}.${shade}.${step}]${opacity === null || opacity === 1 ? '' : `[${opacity}]`}`;

export const rampKey = ({ type, shade }: PaletteRampRef) => `${type}.${shade}`;

export const parseRampKey = (key: string): PaletteRampRef => {
    const [type, shade] = key.split('.');
    return { type: type as PaletteType, shade };
};

export const sameRamp = (a: PaletteRampRef, b: PaletteRampRef) => a.type === b.type && a.shade === b.shade;

const naturalCompare = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

/** Порядок растяжек: сначала `general`, затем `additional`, внутри типа — естественный порядок `shade`. */
export const compareRamps = (a: PaletteRampRef, b: PaletteRampRef) =>
    a.type === b.type ? naturalCompare(a.shade, b.shade) : a.type === 'general' ? -1 : 1;

/** Значение HEX с альфа-каналом `round(opacity * 255)`, как в `ds-service` и `js/cli`. */
export const withOpacity = (hex: string, opacity: number | null) => {
    if (opacity === null || opacity >= 1) return hex;
    const alpha = Math.round(Math.max(0, opacity) * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
    return `${hex.slice(0, 7)}${alpha}`;
};
