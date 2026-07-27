import type { MetaGrouped, Palette, ThemeMeta, TokensContent } from './types.ts';
import { WEB_BREAKPOINTS } from './constants.ts';

export const kebabToCamel = (value: string) =>
    value
        .replace(/-([a-z0-9])/g, (_, group: string) => group.toUpperCase())
        .replace(/^./, (char) => char.toLowerCase());

export const groupEnabledTokens = (meta: ThemeMeta) =>
    meta.tokens
        .filter((token) => token.enabled)
        .reduce<MetaGrouped>((result, token) => {
            result[token.type] = [...(result[token.type] ?? []), token];
            return result;
        }, {});

export const restorePaletteColor = (value: string, palette: Palette) => {
    const match = value.match(/^\[([^.]+)\.([^.]+)\.([^\]]+)\](?:\[([^\]]+)\])?$/);

    if (!match) {
        return value;
    }

    const [, , colorName, shade, opacity] = match;
    const color = palette[colorName]?.[shade];

    if (!color) {
        return value;
    }

    if (!opacity) {
        return color;
    }

    const alpha = Math.round(Number(opacity) * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();

    return `${color.slice(0, 7)}${alpha}`;
};

export const getSelector = (content: string, selector = ':root') => `
${selector} {
${content}
}`;

const getMediaQuery = (from?: number, to?: number) => {
    if (from && !to) {
        return `@media (max-width: ${from}px)`;
    }
    if (from && to) {
        return `@media (min-width: ${from}px) and (max-width: ${to}px)`;
    }
    if (!from && to) {
        return `@media (min-width: ${to}px)`;
    }
    return '';
};

export const getBreakpointSelector = (content: string, from?: number, to?: number, selector = ':root') => `
${getMediaQuery(from, to)} {
  ${selector} {
${content.replace(/ {2}/gim, '    ')}
  }
}`;

export const getThemeContent = (content: TokensContent) => {
    const { screenS, screenM, screenL } = WEB_BREAKPOINTS;

    return [
        getSelector(content.colorTokens),
        getSelector(content.gradientTokens),
        getSelector(content.shadowTokens),
        getSelector(content.shapeTokens),
        getSelector(content.spacingTokens),
        getSelector(content.typographyTokens.root),
        getBreakpointSelector(content.typographyTokens.screenS, screenS.from),
        getBreakpointSelector(content.typographyTokens.screenM, screenM.from, screenM.to),
        getBreakpointSelector(content.typographyTokens.screenL, screenL.from, screenL.to),
    ].join('\n');
};
