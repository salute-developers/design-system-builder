import type { TypographyScreen, TypographyStyle, TypographyStyles, UpdatedTypographyStyle } from './domain';

/** Стиль Body M на экране [screen] со значениями темы `base`. */
export const bodyM = (screen: TypographyScreen, overrides: Partial<TypographyStyle> = {}): TypographyStyle => ({
    screen,
    group: 'body',
    size: 'm',
    sizePx: 16,
    lineHeightPx: 20,
    letterSpacingEm: -0.02,
    fontFamily: 'body',
    variants: {
        normal: { tokenId: `${screen}.body.m.normal`, weight: 400 },
        medium: { tokenId: `${screen}.body.m.medium`, weight: 500 },
        bold: { tokenId: `${screen}.body.m.bold`, weight: 600 },
    },
    components: [
        { name: 'Combobox', count: 6 },
        { name: 'Accordion', count: 5 },
    ],
    ...overrides,
});

const headerH1 = (screen: TypographyScreen, sizePx: number): TypographyStyle => ({
    ...bodyM(screen),
    group: 'header',
    size: 'h1',
    sizePx,
    lineHeightPx: sizePx + 4,
    fontFamily: 'header',
    variants: {
        normal: { tokenId: `${screen}.header.h1.normal`, weight: 400 },
        medium: { tokenId: `${screen}.header.h1.medium`, weight: 500 },
        bold: { tokenId: `${screen}.header.h1.bold`, weight: 600 },
    },
    components: [],
});

/** Стили темы: Body M на трёх экранах, H1 — только на крупных и средних. */
export const typographyStyles = (overrides: Partial<TypographyStyles> = {}): TypographyStyles => ({
    editRevision: 3,
    canEdit: true,
    themeCount: 2,
    families: [
        { name: 'display', fontName: 'SB Sans Display' },
        { name: 'body', fontName: 'SB Sans Text' },
    ],
    screens: [
        { screen: 'screen-l', styles: [headerH1('screen-l', 48), bodyM('screen-l')] },
        { screen: 'screen-m', styles: [headerH1('screen-m', 40), bodyM('screen-m')] },
        { screen: 'screen-s', styles: [bodyM('screen-s', { sizePx: 14 })] },
    ],
    ...overrides,
});

/** Ответ изменения стиля [style] с ревизией [editRevision]. */
export const updated = (style: TypographyStyle, editRevision: number): UpdatedTypographyStyle => ({
    editRevision,
    style,
    tokens: Object.values(style.variants).map((variant) => ({
        tokenId: variant!.tokenId,
        name: variant!.tokenId,
        values: [{ platform: 'web' as const, value: [{ fontSize: `${style.sizePx / 16}rem` }] }],
    })),
});
