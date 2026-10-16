// Перенос `builder/color-utils.js` прототипа: те же формулы и округления, чтобы перестройка
// растяжки давала побайтно те же значения, что прототип и ds-service.

export interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface Hsl {
    h: number;
    s: number;
    l: number;
}

const normalizeHex = (hex: string, includeAlpha = false) => {
    let value = String(hex || '')
        .trim()
        .replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(value)) {
        value = value
            .split('')
            .map((channel) => channel + channel)
            .join('');
    }
    if (includeAlpha && /^[0-9a-f]{6}$/i.test(value)) value += 'ff';
    if (!includeAlpha && /^[0-9a-f]{8}$/i.test(value)) value = value.slice(0, 6);
    return value;
};

export const isHexColor = (value: string) => /^#?[0-9A-Fa-f]{6}$/.test(value.trim());

export const toUpperHex = (value: string) => `#${normalizeHex(value).toUpperCase()}`;

export const hexToRgba = (hex: string): Rgba | null => {
    const value = normalizeHex(hex, true);
    if (!/^[0-9a-f]{8}$/i.test(value)) return null;
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
        a: parseInt(value.slice(6, 8), 16) / 255,
    };
};

export const rgbaToHex = ({ r, g, b, a = 1 }: Omit<Rgba, 'a'> & { a?: number }) => {
    const channel = (value: number) =>
        Math.round(Math.max(0, Math.min(255, value)))
            .toString(16)
            .padStart(2, '0');
    const base = `#${channel(r)}${channel(g)}${channel(b)}`;
    return a >= 1 ? base : base + channel(a * 255);
};

export const rgbToHsl = ({ r, g, b }: Omit<Rgba, 'a'>): Hsl => {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;

    if (delta) {
        s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        if (max === red) h = ((green - blue) / delta) % 6;
        else if (max === green) h = (blue - red) / delta + 2;
        else h = (red - green) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
    }

    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const hslToRgb = ({ h, s, l }: Hsl) => {
    const hue = ((h % 360) + 360) % 360;
    const saturation = s / 100;
    const lightness = l / 100;
    const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = lightness - c / 2;
    const [r, g, b] =
        hue < 60
            ? [c, x, 0]
            : hue < 120
              ? [x, c, 0]
              : hue < 180
                ? [0, c, x]
                : hue < 240
                  ? [0, x, c]
                  : hue < 300
                    ? [x, 0, c]
                    : [c, 0, x];
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
};

const luminance = (hex: string) => {
    const value = normalizeHex(hex);
    if (!/^[0-9a-f]{6}$/i.test(value)) return null;
    const [r, g, b] = [0, 2, 4]
        .map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
        .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (first: string, second: string) => {
    const a = luminance(first);
    const b = luminance(second);
    if (a === null || b === null) return null;
    const [light, dark] = a > b ? [a, b] : [b, a];
    return (light + 0.05) / (dark + 0.05);
};

/** Цвет подписи свотча по правилу `paletteSwatchLabelStyle` прототипа. */
export const swatchLabelColor = (background: string): '#000000' | '#FFFFFF' => {
    const foreground = hexToRgba(background);
    const backdrop = hexToRgba('#202327')!;
    const effective =
        foreground && foreground.a < 1
            ? rgbaToHex({
                  r: foreground.r * foreground.a + backdrop.r * (1 - foreground.a),
                  g: foreground.g * foreground.a + backdrop.g * (1 - foreground.a),
                  b: foreground.b * foreground.a + backdrop.b * (1 - foreground.a),
                  a: 1,
              })
            : background;
    const darkRatio = contrastRatio('#000000', effective) || 0;
    const lightRatio = contrastRatio('#FFFFFF', effective) || 0;
    return darkRatio >= lightRatio ? '#000000' : '#FFFFFF';
};
