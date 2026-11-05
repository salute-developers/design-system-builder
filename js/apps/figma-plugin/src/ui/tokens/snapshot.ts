import type {
    DimensionTokenDto,
    ShadowLayerDto,
    SizeTokensDto,
    TokenDefinitionDto,
    TokenValueDto,
    TypographyScreenId,
    TypographyStyleDto,
    TypographyStylesDto,
} from '../api/types';

/** Значение цветового токена для показа; нераспознанное значение показывается как есть. */
export type PaintValue =
    | { kind: 'color'; css: string }
    | { kind: 'gradient'; css: string }
    | { kind: 'unknown'; raw: string }
    | { kind: 'empty' };

export interface ColorToken {
    id: string;
    name: string;
    label: string;
    group: string;
    light: PaintValue;
    dark: PaintValue;
}

export interface TypographyStyle {
    id: string;
    name: string;
    label: string;
    group: string;
    sizePx: number;
    lineHeightPx: number;
    letterSpacingEm: number;
    weights: number[];
    fontName: string;
}

export interface TypographyScreen {
    screen: TypographyScreenId;
    styles: TypographyStyle[];
}

export interface DimensionToken {
    id: string;
    name: string;
    valuePx: number | null;
    fullRounding: boolean;
}

export interface ShadowToken {
    id: string;
    name: string;
    layers: ShadowLayerDto[];
}

/** Токены темы на выбранной границе: общая модель экрана и будущего экспорта в Figma. */
export interface TokenSnapshot {
    colors: ColorToken[];
    typography: TypographyScreen[];
    radii: DimensionToken[];
    spacing: DimensionToken[];
    shadows: ShadowToken[];
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const GRADIENT = /gradient\(/i;

/** Значение веба приходит массивом: цвет — одна строка, градиент — CSS-строки слоёв. */
export const parsePaint = (value: unknown): PaintValue => {
    if (value === null || value === undefined) return { kind: 'empty' };
    const layers = Array.isArray(value) ? value : [value];
    if (!layers.length) return { kind: 'empty' };
    if (layers.every((layer) => typeof layer === 'string')) {
        const text = layers.join(', ');
        if (layers.length === 1 && HEX.test(text)) return { kind: 'color', css: text };
        if (GRADIENT.test(text)) return { kind: 'gradient', css: text };
    }
    return { kind: 'unknown', raw: JSON.stringify(value) };
};

const webPaint = (values: TokenValueDto[], mode: 'light' | 'dark') => {
    const value = values.find((item) => item.mode === mode) ?? values.find((item) => item.mode === null);
    return parsePaint(value?.value);
};

const colorTokens = (tokens: TokenDefinitionDto[], values: TokenValueDto[]): ColorToken[] => {
    const byToken = new Map<string, TokenValueDto[]>();
    values
        .filter((value) => value.platform === 'web')
        .forEach((value) => byToken.set(value.tokenId, [...(byToken.get(value.tokenId) ?? []), value]));
    return tokens
        .filter((token) => token.enabled && (token.type === 'color' || token.type === 'gradient'))
        .map((token) => {
            const web = byToken.get(token.id) ?? [];
            return {
                id: token.id,
                name: token.name,
                label: token.displayName || token.name,
                group: token.name.split('.')[0],
                light: webPaint(web, 'light'),
                dark: webPaint(web, 'dark'),
            };
        });
};

const SIZE_LABEL = /^(x*[sml]|h\d+)$/;

const typographyStyle = (style: TypographyStyleDto, fonts: Map<string, string>): TypographyStyle => {
    const variants = Object.values(style.variants).filter((variant) => variant !== undefined);
    return {
        id: variants[0]?.tokenId ?? `${style.group}.${style.size}`,
        name: `${style.group}.${style.size}`,
        label: SIZE_LABEL.test(style.size) ? style.size.toUpperCase() : style.size,
        group: style.group,
        sizePx: style.sizePx,
        lineHeightPx: style.lineHeightPx,
        letterSpacingEm: style.letterSpacingEm,
        weights: variants.map((variant) => variant.weight),
        fontName: fonts.get(style.fontFamily) || style.fontFamily,
    };
};

const dimension = (token: DimensionTokenDto): DimensionToken => ({
    id: token.tokenId,
    name: token.name,
    valuePx: token.valuePx,
    fullRounding: token.fullRounding ?? false,
});

/** Собирает снимок темы из ответов разделов. */
export const buildSnapshot = (source: {
    tokens: TokenDefinitionDto[];
    values: TokenValueDto[];
    typography: TypographyStylesDto;
    sizes: SizeTokensDto;
}): TokenSnapshot => {
    const fonts = new Map(source.typography.families.map((family) => [family.name, family.fontName]));
    return {
        colors: colorTokens(source.tokens, source.values),
        typography: source.typography.screens.map(({ screen, styles }) => ({
            screen,
            styles: styles.map((style) => typographyStyle(style, fonts)),
        })),
        radii: (source.sizes.radii ?? []).map(dimension),
        spacing: (source.sizes.spacing ?? []).map(dimension),
        shadows: (source.sizes.shadows ?? []).map(({ tokenId, name, layers }) => ({ id: tokenId, name, layers })),
    };
};

/** Совпадения по имени без учёта регистра; совпадения с начала имени — первыми. */
export const searchByName = <T extends { name: string; label: string }>(items: T[], query: string): T[] => {
    const text = query.trim().toLowerCase();
    if (!text) return items;
    const rank = (item: T) => {
        const names = [item.name.toLowerCase(), item.label.toLowerCase()];
        if (names.some((name) => name.startsWith(text))) return 0;
        return names.some((name) => name.includes(text)) ? 1 : 2;
    };
    return items
        .map((item) => ({ item, rank: rank(item) }))
        .filter(({ rank: value }) => value < 2)
        .sort((a, b) => a.rank - b.rank)
        .map(({ item }) => item);
};

/** Элементы по группам в порядке появления. */
export const groupBy = <T extends { group: string }>(items: T[]) => {
    const groups = new Map<string, T[]>();
    items.forEach((item) => groups.set(item.group, [...(groups.get(item.group) ?? []), item]));
    return [...groups.entries()].map(([group, members]) => ({ group, items: members }));
};
