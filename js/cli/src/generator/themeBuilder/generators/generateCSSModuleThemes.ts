import path from 'path';
import { writeGeneratedToFS } from '@salutejs/plasma-tokens-utils';
import { generateCommonFile } from '@salutejs/plasma-tokens-utils/lib/generators/generateFile.js';

import { Breakpoint, GENERATE_MESSAGE_FOR_CSS, ThemeContent } from '../types/index.ts';
import { getSelector, getTypographyBreakpoints } from '../utils/index.ts';

export const generateCSSModuleThemes = (
    srcDir: string,
    themeName: string,
    themeContent: ThemeContent,
    breakpoints: Breakpoint[],
) => {
    const themesDir = path.join(srcDir, 'css');

    const darkSelector = '.dark';
    const lightSelector = '.light';
    const groupSelector = [darkSelector, lightSelector].join(', ');

    const darkContent = [
        getSelector(themeContent.dark.colorTokens, darkSelector),
        getSelector(themeContent.dark.gradientTokens, darkSelector),
    ].join('\n');

    const lightContent = [
        getSelector(themeContent.light.colorTokens, lightSelector),
        getSelector(themeContent.light.gradientTokens, lightSelector),
    ].join('\n');

    const breakpointContent = [
        getSelector(themeContent.dark.shadowTokens, groupSelector),
        getSelector(themeContent.dark.shapeTokens, groupSelector),
        getSelector(themeContent.dark.spacingTokens, groupSelector),
        getSelector(themeContent.dark.typographyTokens.root, groupSelector),
        ...getTypographyBreakpoints(themeContent.dark.typographyTokens, breakpoints, groupSelector),
    ].join('\n');

    const file = generateCommonFile(
        `${themeName}.module`,
        'css',
        [darkContent, lightContent, breakpointContent].join('\n'),
    );

    writeGeneratedToFS(themesDir, [file], GENERATE_MESSAGE_FOR_CSS);
};
