import { hexToRgba, rgbToHsl } from './color';
import type { PaletteAnchor, PaletteRampRef } from './types';

const ADDITIONAL_NAMES: Record<string, string> = {
    h0: 'Red',
    h10: 'Scarlet',
    h20: 'Orange',
    h30: 'Tangerine',
    h40: 'Amber',
    h50: 'Gold',
    h60: 'Chartreuse',
    h70: 'Lime',
    h80: 'Grass',
    h90: 'Leaf',
    h100: 'Emerald',
    h110: 'Malachite',
    h120: 'Jade',
    h130: 'Green',
    h140: 'Mint',
    h150: 'Teal',
    h160: 'Cyan',
    h170: 'Aqua',
    h180: 'Sky',
    h190: 'Azure',
    h200: 'Blue',
    h210: 'Cobalt',
    h220: 'Ultramarine',
    h230: 'Indigo',
    h240: 'Blue Violet',
    h250: 'Violet',
    h260: 'Purple',
    h270: 'Amethyst',
    h280: 'Lavender',
    h290: 'Orchid',
    h300: 'Magenta',
    h310: 'Fuchsia',
    h320: 'Pink',
    h330: 'Rose',
    h340: 'Raspberry',
    h350: 'Coral',
};

const REBUILD_ANCHORS: Array<[number, string]> = [
    [0, 'Red'],
    [18, 'Orange'],
    [38, 'Amber'],
    [52, 'Yellow'],
    [76, 'Lime'],
    [125, 'Green'],
    [165, 'Teal'],
    [185, 'Cyan'],
    [210, 'Blue'],
    [225, 'Cobalt'],
    [245, 'Indigo'],
    [270, 'Violet'],
    [292, 'Purple'],
    [315, 'Magenta'],
    [335, 'Rose'],
    [350, 'Coral'],
    [360, 'Red'],
];

const words = (shade: string) =>
    shade
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

/** Имя растяжки шаблона: `coolGray` → `Cool Gray`, `h130` → `Green`. */
export const templateRampName = ({ type, shade }: PaletteRampRef) =>
    type === 'general' ? words(shade) : (ADDITIONAL_NAMES[shade] ?? shade.toUpperCase());

/** Подпись под именем: для `additional` — `Hue N`, для `general` — тип. */
/**
 * Подпись растяжки шаблона, как `paletteMetaLabel` прототипа: «Hue130» для `additional`, «Neutral» для серых
 * семейств; у прочих семейств `general` аналога в прототипе нет — «General».
 */
export const templateRampMeta = ({ type, shade }: PaletteRampRef) =>
    type === 'additional' ? `Hue${shade.replace(/^h/, '')}` : /gray$/i.test(shade) ? 'Neutral' : 'General';

/** Ближайшее к тону название по правилу `sourcePaletteFriendlyIdentity` прототипа. */
export const friendlyColorName = (hex: string, fallback: string) => {
    const color = hexToRgba(hex);
    if (!color) return fallback;
    const hsl = rgbToHsl(color);
    if (hsl.s < 8) return 'Gray';
    return REBUILD_ANCHORS.reduce((best, item) => (Math.abs(item[0] - hsl.h) < Math.abs(best[0] - hsl.h) ? item : best))[1];
};

export const rampDisplayName = (source: PaletteRampRef, anchor: Pick<PaletteAnchor, 'value'> | null) =>
    anchor ? friendlyColorName(anchor.value, templateRampName(source)) : templateRampName(source);
