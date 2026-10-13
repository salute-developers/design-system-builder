import fs from 'fs';

import { ThemeRequest, ThemeSource } from './types';
import {
    createGradientTokens,
    createShadowTokens,
    createShapeTokens,
    createSpacingTokens,
    createTypographyTokens,
    createViewContainerTokens,
} from './creators';
import {
    generateCSSThemes,
    generateCSSModuleThemes,
    generateRootIndex,
    generateThemes,
    generateTokens,
} from './generators';
import { getMetaGrouped, readTheme, fallbackCreateColorTokensWrapper } from './utils';

/** Переменные одной темы: CSS для файлов темы и JS для файла токенов. */
const createThemeVariables = (themeName: string, { meta, variations }: ThemeSource) => {
    const isJS = true;
    const metaGrouped = getMetaGrouped(meta);

    // TODO: Использовать createColorTokens: https://github.com/salute-developers/plasma/issues/1363
    const colorCSSVariables = fallbackCreateColorTokensWrapper(themeName, variations.color, metaGrouped.color);
    const colorJSVariables = fallbackCreateColorTokensWrapper(themeName, variations.color, metaGrouped.color, isJS);

    const gradientCSSVariables = createGradientTokens(variations.gradient, metaGrouped.gradient);
    const gradientJSVariables = createGradientTokens(variations.gradient, metaGrouped.gradient, isJS);

    const shapeCSSVariables = createShapeTokens(variations.shape, metaGrouped.shape);
    const shapeJSVariables = createShapeTokens(variations.shape, metaGrouped.shape, isJS);

    const spacingCSSVariables = createSpacingTokens(variations.spacing, metaGrouped.spacing);
    const spacingJSVariables = createSpacingTokens(variations.spacing, metaGrouped.spacing, isJS);

    const shadowCSSVariables = createShadowTokens(variations.shadow, metaGrouped.shadow);
    const shadowJSVariables = createShadowTokens(variations.shadow, metaGrouped.shadow, isJS);

    const typographyCSSVariables = createTypographyTokens(
        variations.typography,
        variations.fontFamily,
        metaGrouped.typography,
    );
    const typographyJSVariables = createTypographyTokens(
        variations.typography,
        variations.fontFamily,
        metaGrouped.typography,
        true,
    );

    const viewContainerVariables = createViewContainerTokens(metaGrouped.color, metaGrouped.gradient);

    return {
        css: {
            dark: {
                colorTokens: colorCSSVariables.dark,
                gradientTokens: gradientCSSVariables.dark,
                shadowTokens: shadowCSSVariables.dark,
                shapeTokens: shapeCSSVariables.dark,
                spacingTokens: spacingCSSVariables.dark,
                typographyTokens: typographyCSSVariables.dark,
            },
            light: {
                colorTokens: colorCSSVariables.light,
                gradientTokens: gradientCSSVariables.light,
                shadowTokens: shadowCSSVariables.light,
                shapeTokens: shapeCSSVariables.light,
                spacingTokens: spacingCSSVariables.light,
                typographyTokens: typographyCSSVariables.light,
            },
        },
        tokens: {
            colorTokens: colorJSVariables.dark,
            gradientTokens: gradientJSVariables.dark,
            shadowTokens: shadowJSVariables.dark,
            shapeTokens: shapeJSVariables.dark,
            spacingTokens: spacingJSVariables.dark,
            typographyTokens: typographyJSVariables.dark,
            viewContainerTokens: viewContainerVariables,
        },
    };
};

/**
 * Пишет файлы одной темы и её CSS; возвращает содержимое файла токенов этой темы.
 *
 * Индекс `themes/index.ts` пишется вместе с файлами темы: запись в существующий файл дописывает его,
 * поэтому у нескольких тем в одном каталоге индекс накапливает экспорты в порядке генерации.
 */
const writeThemeFiles = (themeDir: string, themeName: string, themeSource: ThemeSource) => {
    const { css, tokens } = createThemeVariables(themeName, themeSource);
    const { name } = themeSource.meta;

    generateThemes(themeDir, name, css);

    generateCSSThemes(themeDir, name, css);

    generateCSSModuleThemes(themeDir, name, css);

    return tokens;
};

export const generate = async (themes: ThemeRequest[], externalThemeSource?: ThemeSource, srcDir = 'src') => {
    const themeDir = srcDir;

    fs.mkdirSync(themeDir, { recursive: true });

    for (const theme of themes) {
        const themeSource = externalThemeSource || (await readTheme(theme.name, theme.version));

        generateTokens(themeDir, themeSource.meta.name, writeThemeFiles(themeDir, theme.name, themeSource));
    }

    // TODO: do we need this?
    // const themeDefault = await readTheme('default', 'latest');
    // const metaGroupedDefault = getMetaGrouped(themeDefault.meta);

    // const colorDefaultJSVariables = createColorTokens(undefined, metaGroupedDefault.color, isJS).dark;
    // const gradientDefaultJSVariables = createGradientTokens(undefined, metaGroupedDefault.gradient, isJS).dark;
    // const shapeDefaultJSVariables = createShapeTokens(undefined, metaGroupedDefault.shape, isJS).dark;
    // const spacingDefaultJSVariables = createSpacingTokens(undefined, metaGroupedDefault.spacing, isJS).dark;
    // const shadowDefaultJSVariables = createShadowTokens(undefined, metaGroupedDefault.shadow, isJS).dark;
    // const typographyDefaultJSVariables = createTypographyTokens(
    //     undefined,
    //     undefined,
    //     metaGroupedDefault.typography,
    //     true,
    // ).dark;

    // generateDefaultTokens(themeDir, {
    //     colorTokens: colorDefaultJSVariables,
    //     gradientTokens: gradientDefaultJSVariables,
    //     shadowTokens: shadowDefaultJSVariables,
    //     shapeTokens: shapeDefaultJSVariables,
    //     spacingTokens: spacingDefaultJSVariables,
    //     typographyTokens: typographyDefaultJSVariables,
    // });
    generateRootIndex(themeDir);
};

/**
 * Пишет несколько тем одной дизайн-системы в общий пустой `srcDir`: файлы и CSS каждой темы, один индекс
 * со всеми темами и один файл токенов.
 *
 * Имена переменных у тем одной дизайн-системы совпадают, различаются значения. Запасное значение
 * в файле токенов одно, поэтому оно берётся из темы по умолчанию: `defaultThemeName` или первой.
 * Порядок экспортов в индексе совпадает с порядком `themeSources`.
 */
export const generateThemeSet = async (
    themeSources: ThemeSource[],
    srcDir = 'src',
    { defaultThemeName }: { defaultThemeName?: string } = {},
) => {
    const names = themeSources.map(({ meta }) => meta.name);
    if (names.length === 0) {
        throw new Error('No themes to generate.');
    }
    // Без учёта регистра: имя темы — имя файла, а запись в существующий файл его дописывает.
    const keys = names.map((name) => name.toLowerCase());
    const duplicate = names.find((_, index) => keys.indexOf(keys[index]) !== index);
    if (duplicate) {
        throw new Error(`Theme name "${duplicate}" is used by more than one theme.`);
    }
    const defaultName = defaultThemeName ?? names[0];
    if (!names.includes(defaultName)) {
        throw new Error(`Default theme "${defaultName}" is not among the generated themes: ${names.join(', ')}.`);
    }

    fs.mkdirSync(srcDir, { recursive: true });

    for (const themeSource of themeSources) {
        const tokens = writeThemeFiles(srcDir, themeSource.meta.name, themeSource);
        if (themeSource.meta.name === defaultName) {
            generateTokens(srcDir, defaultName, tokens);
        }
    }

    generateRootIndex(srcDir);
};
