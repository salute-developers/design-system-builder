import path from 'path';
import fs from 'fs';
import { writeGeneratedToFS } from '@salutejs/plasma-tokens-utils';
import { generateCommonFile } from '@salutejs/plasma-tokens-utils/lib/generators/generateFile';

import { ThemeContent } from '../types';

export const generateTokens = (srcDir: string, themeName: string, themeContent: ThemeContent['dark']) => {
    const themesDir = path.join(srcDir, 'tokens');
    fs.mkdirSync(themesDir, { recursive: true });

    // const themeDir = path.join(themesDir, themeName);

    const content = [
        themeContent.colorTokens,
        themeContent.gradientTokens,
        themeContent.shadowTokens,
        themeContent.shapeTokens,
        themeContent.spacingTokens,
        themeContent.typographyTokens.screenS,
        themeContent.viewContainerTokens,
    ].join('\n');

    writeGeneratedToFS(themesDir, [generateCommonFile('index', 'ts', content)]);
};
