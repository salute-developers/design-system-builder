import {
    ColorToken,
    FontFamilyToken,
    GradientToken,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    TypographyToken,
} from '../../themeBuilder';
import { Token } from '../../themeBuilder/tokens/token';

export interface GroupedToken<T extends Token = Token> {
    data: T[] | GroupedToken<T>[];
    group?: string;
}

const getColorTokensCategories = <T extends Token>(
    tokens: T[],
    mode?: string,
    category?: string,
    subcategory?: string[],
) =>
    tokens.filter(
        (item) =>
            item.getTags()[0] === mode && item.getTags()[1] === category && subcategory?.includes(item.getTags()[2]),
    );

const getColorTokensSubcategories = <T extends Token>(tokens: T[], mode?: string, subcategory?: string[]) => [
    {
        data: getColorTokensCategories(tokens, mode, 'text', subcategory),
        group: 'text',
    },
    {
        data: getColorTokensCategories(tokens, mode, 'surface', subcategory),
        group: 'surface',
    },
    {
        data: getColorTokensCategories(tokens, mode, 'background', subcategory),
        group: 'background',
    },
    {
        data: getColorTokensCategories(tokens, mode, 'overlay', subcategory),
        group: 'overlay',
    },
    {
        data: getColorTokensCategories(tokens, mode, 'outline', subcategory),
        group: 'outline',
    },
];

export const getGroupedColorTokens = (colorTokens: ColorToken[], colorMode?: string) => [
    {
        data: getColorTokensSubcategories(colorTokens, colorMode, ['default']),
        group: 'default',
    },
    {
        data: getColorTokensSubcategories(colorTokens, colorMode, ['dark', 'on-dark']),
        group: 'onDark',
    },
    {
        data: getColorTokensSubcategories(colorTokens, colorMode, ['light', 'on-light']),
        group: 'onLight',
    },
    {
        data: getColorTokensSubcategories(colorTokens, colorMode, ['inverse']),
        group: 'inverse',
    },
];

export const getGroupedGradientTokens = (gradientTokens: GradientToken[], gradientMode?: string) => [
    {
        data: getColorTokensSubcategories(gradientTokens, gradientMode, ['default']),
        group: 'default',
    },
    {
        data: getColorTokensSubcategories(gradientTokens, gradientMode, ['dark', 'on-dark']),
        group: 'onDark',
    },
    {
        data: getColorTokensSubcategories(gradientTokens, gradientMode, ['light', 'on-light']),
        group: 'onLight',
    },
    {
        data: getColorTokensSubcategories(gradientTokens, gradientMode, ['inverse']),
        group: 'inverse',
    },
];

export const getGroupedShapeTokens = (shapeTokens: ShapeToken[]) => [
    {
        data: shapeTokens,
    },
];

export const getGroupedShadowTokens = (shadowTokens: ShadowToken[], shadowMode?: string) => [
    {
        data: shadowTokens.filter((item) => item.getTags()[0] === shadowMode),
    },
];

export const getGroupedSpacingTokens = (spacingTokens: SpacingToken[], spacingMode?: string) => [
    {
        data: spacingTokens.filter((item) => item.getTags()[0] === spacingMode),
    },
];

export const getGroupedTypographyTokens = (typographyTokens: TypographyToken[], typographyMode?: string) => [
    {
        data: typographyTokens.filter((item) => item.getTags()[0] === typographyMode),
    },
];

export const getGroupedFontFamilyTokens = (fontFamilyTokens: FontFamilyToken[], fontFamilyMode?: string) => [
    {
        data: fontFamilyTokens.filter((item) => item.getTags()[0] === fontFamilyMode),
    },
];
