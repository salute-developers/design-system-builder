import {
    createColorTokens,
    createDefaultColorTokens,
    createMockColorTokens,
    createGradientTokens,
    createDefaultGradientTokens,
    createMockGradientTokens,
    createMockShadowTokens,
    createDefaultShadowTokens,
    createShadowTokens,
    createMockShapeTokens,
    createDefaultShapeTokens,
    createShapeTokens,
    createMockTypographyTokens,
    createDefaultTypographyTokens,
    createTypographyTokens,
    createFontFamilyTokens,
    createDefaultFontFamilyTokens,
    createMockFontFamilyTokens,
    createDefaultSpacingTokens,
    createSpacingTokens,
    createMockSpacingTokens,
} from '../tokens';
import type { PlatformsVariations, ThemeConfig, ThemeMeta, TokenType } from '../types';
import { Theme } from '.';

export const buildDefaultTheme = (config: ThemeConfig) => {
    const color = createDefaultColorTokens(config);
    const gradient = createDefaultGradientTokens(config);
    const shadow = createDefaultShadowTokens(config);
    const shape = createDefaultShapeTokens(config);
    const spacing = createDefaultSpacingTokens(config);
    const typography = createDefaultTypographyTokens(config);
    const fontFamily = createDefaultFontFamilyTokens(config);

    return new Theme(config.name, '0.1.0', {
        color,
        gradient,
        shadow,
        shape,
        spacing,
        typography,
        fontFamily,
    });
};

export const buildTheme = (meta: ThemeMeta, variations: PlatformsVariations, includeExtraTokens = false) => {
    const metaGrouped = meta.tokens.reduce((acc, token) => {
        return {
            ...acc,
            [token.type]: [...(acc[token.type] || []), token],
        };
    }, {} as Record<TokenType['type'], Array<TokenType>>);

    const color = createColorTokens(metaGrouped.color, variations.color, includeExtraTokens);
    const gradient = createGradientTokens(metaGrouped.gradient, variations.gradient, includeExtraTokens);
    const shadow = createShadowTokens(metaGrouped.shadow, variations.shadow);
    const shape = createShapeTokens(metaGrouped.shape, variations.shape);
    const spacing = createSpacingTokens(metaGrouped.spacing, variations.spacing);
    const typography = createTypographyTokens(metaGrouped.typography, variations.typography);
    const fontFamily = createFontFamilyTokens(metaGrouped.fontFamily, variations.fontFamily);

    return new Theme(meta.name, meta.version, {
        color,
        gradient,
        shadow,
        shape,
        spacing,
        typography,
        fontFamily,
    });
};

// TODO: Удалить метод после завершения разработки разделов с токенами
export const buildMockTheme = () => {
    const color = createMockColorTokens();
    const gradient = createMockGradientTokens();
    const shadow = createMockShadowTokens();
    const shape = createMockShapeTokens();
    const spacing = createMockSpacingTokens();
    const typography = createMockTypographyTokens();
    const fontFamily = createMockFontFamilyTokens();

    return new Theme('mock', '0.1.0', {
        color,
        gradient,
        shadow,
        shape,
        spacing,
        typography,
        fontFamily,
    });
};
