import path from 'path';
import { writeGeneratedToFS } from '@salutejs/plasma-tokens-utils';
import { generateCommonFile } from '@salutejs/plasma-tokens-utils/lib/generators/generateFile.js';

import { Breakpoint, GENERATE_MESSAGE_FOR_CSS, ThemeContent, ThemeMode } from '../types/index.ts';
import { getSelector, getTypographyBreakpoints } from '../utils/index.ts';

export const generateCSSThemes = (
    srcDir: string,
    themeName: string,
    themeContent: ThemeContent,
    breakpoints: Breakpoint[],
) => {
    const themesDir = path.join(srcDir, 'css');

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

    writeGeneratedToFS(
        themesDir,
        [
            generateCommonFile(`${themeName}__dark`, 'css', getContent('dark')),
            generateCommonFile(`${themeName}__light`, 'css', getContent('light')),
        ],
        GENERATE_MESSAGE_FOR_CSS,
    );
};
