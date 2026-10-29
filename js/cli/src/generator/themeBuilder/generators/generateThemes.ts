import path from 'path';
import { writeGeneratedToFS, generateFile } from '@salutejs/plasma-tokens-utils';
import { generateCommonFile } from '@salutejs/plasma-tokens-utils/lib/generators/generateFile.js';

import { Breakpoint, ThemeContent, ThemeMode } from '../types/index.ts';
import { getSelector, getTypographyBreakpoints } from '../utils/index.ts';

export const generateThemes = (
    srcDir: string,
    themeName: string,
    themeContent: ThemeContent,
    breakpoints: Breakpoint[],
) => {
    const themesDir = path.join(srcDir, 'themes');

    const indexFile = `export { ${themeName}__dark } from './${themeName}__dark';
export { ${themeName}__light } from './${themeName}__light';\n`;

    const getContent = (themeMode: ThemeMode) =>
        [
            getSelector(themeContent[themeMode].colorTokens),
            getSelector(themeContent[themeMode].gradientTokens),
            getSelector(themeContent[themeMode].shadowTokens),
            getSelector(themeContent[themeMode].shapeTokens),
            getSelector(themeContent[themeMode].spacingTokens),
            getSelector(themeContent[themeMode].typographyTokens.root),
            ...getTypographyBreakpoints(themeContent[themeMode].typographyTokens, breakpoints),
        ].join('\n');

    writeGeneratedToFS(themesDir, [
        generateFile(`${themeName}__dark`, `[\`${getContent('dark')}\`] as unknown as TemplateStringsArray`),
        generateFile(`${themeName}__light`, `[\`${getContent('light')}\`] as unknown as TemplateStringsArray`),
        generateCommonFile('index', 'ts', indexFile),
    ]);
};
