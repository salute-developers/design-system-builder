import { getHEXAColor } from '@salutejs/plasma-tokens-utils';

export const colorToHsv = (value: string) => {
    const hex = getHEXAColor(value);
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
    const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
    const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let hueSegment = 0;

    if (delta === 0) {
        hueSegment = 0;
    }

    if (delta !== 0 && max === r) {
        hueSegment = ((g - b) / delta) % 6;
    }

    if (delta !== 0 && max === g) {
        hueSegment = (b - r) / delta + 2;
    }

    if (delta !== 0 && max === b) {
        hueSegment = (r - g) / delta + 4;
    }

    const h = (Math.round(hueSegment * 60) + 360) % 360;

    const s = max === 0 ? 0 : Math.round((delta / max) * 100);
    const v = Math.round(max * 100);

    return { h, s, v };
};

const hsvToHex = (h: number, s: number, v: number) => {
    const saturation = s / 100;
    const value = v / 100;

    const chroma = value * saturation;
    const secondaryComponent = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
    const lightnessOffset = value - chroma;

    const sector = Math.floor(h / 60) % 6;
    const rgbBySector: [number, number, number][] = [
        [chroma, secondaryComponent, 0], // 0-60
        [secondaryComponent, chroma, 0], // 60-120
        [0, chroma, secondaryComponent], // 120-180
        [0, secondaryComponent, chroma], // 180-240
        [secondaryComponent, 0, chroma], // 240-300
        [chroma, 0, secondaryComponent], // 300-360
    ];

    const [r, g, b] = rgbBySector[sector];

    const toHex = (n: number) =>
        Math.round((n + lightnessOffset) * 255)
            .toString(16)
            .padStart(2, '0');

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const getCustomColor = (hue: number, x: number, y: number, brightnessRef: React.RefObject<HTMLDivElement>) => {
    const saturationHSV = Math.round((x / (brightnessRef.current?.offsetWidth ?? 1)) * 100);
    const valueHSV = Math.round(100 - (y / (brightnessRef.current?.offsetHeight ?? 1)) * 100);

    return hsvToHex(hue, saturationHSV, valueHSV);
};

export const getMousePosition = (clientX: number, clientY: number, rect: DOMRect) => {
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));

    return { x, y };
};
