import type {
    TypographyScreen,
    TypographyStyle,
    TypographyStyles,
    TypographyVariantView,
    UpdatedTypographyStyle,
} from './domain';

/** Начертание с токеном [tokenId], весом и значениями трёх платформ с технической редакцией [revision]. */
export const variant = (tokenId: string, weight: number, revision = 0): TypographyVariantView => ({
    tokenId,
    weight,
    valueRevisions: (['web', 'ios', 'android'] as const).map((platform) => ({
        platform,
        valueId: `${tokenId}:${platform}`,
        revision,
    })),
});

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
        normal: variant(`${screen}.body.m.normal`, 400),
        medium: variant(`${screen}.body.m.medium`, 500),
        bold: variant(`${screen}.body.m.bold`, 600),
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
        normal: variant(`${screen}.header.h1.normal`, 400),
        medium: variant(`${screen}.header.h1.medium`, 500),
        bold: variant(`${screen}.header.h1.bold`, 600),
    },
    components: [],
});

/** Стили темы: Body M на трёх экранах, H1 — только на крупных и средних. */
export const typographyStyles = (overrides: Partial<TypographyStyles> = {}): TypographyStyles => ({
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

/** Ответ изменения стиля [style]. */
export const updated = (style: TypographyStyle): UpdatedTypographyStyle => ({
    style,
    tokens: Object.values(style.variants).map((item) => ({
        tokenId: item!.tokenId,
        name: item!.tokenId,
        values: [{ platform: 'web' as const, value: [{ fontSize: `${style.sizePx / 16}rem` }] }],
    })),
});
