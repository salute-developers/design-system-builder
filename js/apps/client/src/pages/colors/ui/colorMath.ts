import { splitTopLevel } from '../../../modules/colorTokens';

/** Преобразования цвета для выбора цвета: HSV — модель поля, HEX с альфой — значение токена. */
export interface Hsva {
    h: number;
    s: number;
    v: number;
    a: number;
}

export interface Rgb {
    r: number;
    g: number;
    b: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const hexToRgba = (value: string): (Rgb & { a: number }) | null => {
    let hex = value.trim().replace('#', '');
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return null;
    const channel = (index: number) => parseInt(hex.slice(index, index + 2), 16);
    return { r: channel(0), g: channel(2), b: channel(4), a: hex.length === 8 ? channel(6) / 255 : 1 };
};

const toHex = (value: number) =>
    Math.round(clamp(value, 0, 255))
        .toString(16)
        .padStart(2, '0');

/** `#RRGGBB` при полной непрозрачности, иначе `#RRGGBBAA`, в верхнем регистре. */
export const rgbaToHex = ({ r, g, b }: Rgb, a = 1) =>
    `#${toHex(r)}${toHex(g)}${toHex(b)}${a < 1 ? toHex(a * 255) : ''}`.toUpperCase();

export const hsvToRgb = ({ h, s, v }: Pick<Hsva, 'h' | 's' | 'v'>): Rgb => {
    const f = (n: number) => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 };
};

export const rgbToHsv = ({ r, g, b }: Rgb): Pick<Hsva, 'h' | 's' | 'v'> => {
    const [rn, gn, bn] = [r / 255, g / 255, b / 255];
    const max = Math.max(rn, gn, bn);
    const delta = max - Math.min(rn, gn, bn);
    let h = 0;
    if (delta) {
        if (max === rn) h = ((gn - bn) / delta) % 6;
        else if (max === gn) h = (bn - rn) / delta + 2;
        else h = (rn - gn) / delta + 4;
    }
    return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
};

export const rgbToHsl = ({ r, g, b }: Rgb) => {
    const [rn, gn, bn] = [r / 255, g / 255, b / 255];
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    const { h } = rgbToHsv({ r, g, b });
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }): Rgb => {
    const sn = s / 100;
    const ln = l / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = sn * Math.min(ln, 1 - ln);
    const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
};

export const hexToHsva = (value: string): Hsva => {
    const rgba = hexToRgba(value) ?? { r: 0, g: 0, b: 0, a: 1 };
    return { ...rgbToHsv(rgba), a: rgba.a };
};

export const hsvaToHex = (hsva: Hsva) => rgbaToHex(hsvToRgb(hsva), hsva.a);

export const clamp01 = (value: number) => clamp(value);

/** Стоп градиента: цвет HEX с альфой и позиция 0–100; `source` — исходная запись цвета, пока её не меняли. */
export interface GradientStop {
    color: string;
    position: number;
    source?: string;
}

export interface LinearGradient {
    angle: number;
    stops: GradientStop[];
}

/** HEX с альфой из `#HEX`, `rgb(...)` или `rgba(...)` стопа; `null` для других записей. */
const stopColor = (value: string): string | null => {
    if (hexToRgba(value)) return value.toUpperCase();
    const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)(%?)\s*)?\)$/i.exec(value);
    if (!rgb) return null;
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] ? 100 : 1);
    return rgbaToHex({ r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }, clamp(alpha));
};

/**
 * Разбор `linear-gradient(<deg>deg, <цвет> p%, …)` с цветами `#HEX`, `rgb()` и `rgba()`; `null`, если слой не в
 * этом виде — тогда градиент нельзя менять в выборе цвета, чтобы не потерять значение.
 */
export const parseLinearGradient = (value: string): LinearGradient | null => {
    const match = /^linear-gradient\((.*)\)$/is.exec(value.trim());
    if (!match) return null;
    const parts = splitTopLevel(match[1]);
    const angleMatch = /^(-?\d+(?:\.\d+)?)deg$/.exec(parts[0] ?? '');
    const angle = angleMatch ? Number(angleMatch[1]) : 180;
    const stops: GradientStop[] = [];
    for (const part of angleMatch ? parts.slice(1) : parts) {
        const stop = /^(.+?)\s+(-?\d+(?:\.\d+)?)%$/.exec(part);
        const color = stop ? stopColor(stop[1].trim()) : null;
        if (!stop || !color) return null;
        stops.push({ color, position: Number(stop[2]), source: stop[1].trim() });
    }
    return stops.length >= 2 ? { angle, stops } : null;
};

const decimal = (value: number) => String(Number(value.toFixed(3)));

/** CSS градиента: дробные угол и позиции сохраняются, неизменённые стопы — в исходной записи. */
export const gradientToCss = ({ angle, stops }: LinearGradient) =>
    `linear-gradient(${decimal(angle)}deg, ${[...stops]
        .sort((a, b) => a.position - b.position)
        .map((stop) => `${stop.source ?? stop.color} ${decimal(stop.position)}%`)
        .join(', ')})`;
