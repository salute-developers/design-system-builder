import {
    createColorTokens,
    createGradientTokens,
    createShadowTokens,
    createShapeTokens,
    createSpacingTokens,
    createTypographyTokens,
    createViewContainerTokens,
} from './creators/index.ts';
import { writeThemeFiles } from './generators/write-theme.ts';
import type { Palette, ThemeContent, ThemeMeta, ThemeVariations } from './types.ts';
import { groupEnabledTokens } from './utils.ts';

export type { Palette, ThemeMeta, ThemeVariations } from './types.ts';

export async function generateTheme(
    meta: ThemeMeta,
    variations: ThemeVariations,
    palette: Palette,
    outputDirectory: string,
) {
    const tokens = groupEnabledTokens(meta);

    const colorCSS = createColorTokens(variations.color, palette, tokens.color);
    const colorJavaScript = createColorTokens(variations.color, palette, tokens.color, true);
    const gradientCSS = createGradientTokens(variations.gradient, tokens.gradient);
    const gradientJavaScript = createGradientTokens(variations.gradient, tokens.gradient, true);
    const shadowCSS = createShadowTokens(variations.shadow, tokens.shadow);
    const shadowJavaScript = createShadowTokens(variations.shadow, tokens.shadow, true);
    const shapeCSS = createShapeTokens(variations.shape, tokens.shape);
    const shapeJavaScript = createShapeTokens(variations.shape, tokens.shape, true);
    const spacingCSS = createSpacingTokens(variations.spacing, tokens.spacing);
    const spacingJavaScript = createSpacingTokens(variations.spacing, tokens.spacing, true);
    const typographyCSS = createTypographyTokens(variations.typography, variations.fontFamily, tokens.typography);
    const typographyJavaScript = createTypographyTokens(
        variations.typography,
        variations.fontFamily,
        tokens.typography,
        true,
    );

    const content: ThemeContent = {
        dark: {
            colorTokens: colorCSS.dark,
            gradientTokens: gradientCSS.dark,
            shadowTokens: shadowCSS.dark,
            shapeTokens: shapeCSS.dark,
            spacingTokens: spacingCSS.dark,
            typographyTokens: typographyCSS.dark,
        },
        light: {
            colorTokens: colorCSS.light,
            gradientTokens: gradientCSS.light,
            shadowTokens: shadowCSS.light,
            shapeTokens: shapeCSS.light,
            spacingTokens: spacingCSS.light,
            typographyTokens: typographyCSS.light,
        },
    };

    await writeThemeFiles({
        content,
        javaScriptTokens: {
            color: colorJavaScript.dark,
            gradient: gradientJavaScript.dark,
            shadow: shadowJavaScript.dark,
            shape: shapeJavaScript.dark,
            spacing: spacingJavaScript.dark,
            typography: typographyJavaScript.dark.screenS,
            viewContainer: createViewContainerTokens(tokens.color, tokens.gradient),
        },
        meta,
        outputDirectory,
    });
}
