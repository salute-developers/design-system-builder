import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CSS_ROBO_COMMENT, ROBO_COMMENT, WEB_BREAKPOINTS } from '../constants.ts';
import type { ThemeContent, ThemeMeta } from '../types.ts';
import { getBreakpointSelector, getSelector, getThemeContent } from '../utils.ts';

interface JavaScriptTokens {
    color: string;
    gradient: string;
    shadow: string;
    shape: string;
    spacing: string;
    typography: string;
    viewContainer: string;
}

interface WriteThemeOptions {
    content: ThemeContent;
    javaScriptTokens: JavaScriptTokens;
    meta: ThemeMeta;
    outputDirectory: string;
}

const writeGeneratedFile = (directory: string, fileName: string, content: string, comment = ROBO_COMMENT) =>
    writeFile(join(directory, fileName), `${comment}${content}`, 'utf8');

const createModuleContent = (content: ThemeContent) => {
    const darkSelector = '.dark';
    const lightSelector = '.light';
    const groupSelector = `${darkSelector}, ${lightSelector}`;
    const { screenS, screenM, screenL } = WEB_BREAKPOINTS;

    return [
        [
            getSelector(content.dark.colorTokens, darkSelector),
            getSelector(content.dark.gradientTokens, darkSelector),
        ].join('\n'),
        [
            getSelector(content.light.colorTokens, lightSelector),
            getSelector(content.light.gradientTokens, lightSelector),
        ].join('\n'),
        [
            getSelector(content.dark.shadowTokens, groupSelector),
            getSelector(content.dark.shapeTokens, groupSelector),
            getSelector(content.dark.spacingTokens, groupSelector),
            getSelector(content.dark.typographyTokens.root, groupSelector),
            getBreakpointSelector(content.dark.typographyTokens.screenS, screenS.from, screenS.to, groupSelector),
            getBreakpointSelector(content.dark.typographyTokens.screenM, screenM.from, screenM.to, groupSelector),
            getBreakpointSelector(content.dark.typographyTokens.screenL, screenL.from, screenL.to, groupSelector),
        ].join('\n'),
    ].join('\n');
};

export async function writeThemeFiles({ content, javaScriptTokens, meta, outputDirectory }: WriteThemeOptions) {
    const themesDirectory = join(outputDirectory, 'themes');
    const cssDirectory = join(outputDirectory, 'css');
    const tokensDirectory = join(outputDirectory, 'tokens');

    await rm(outputDirectory, { recursive: true, force: true });
    await Promise.all([
        mkdir(themesDirectory, { recursive: true }),
        mkdir(cssDirectory, { recursive: true }),
        mkdir(tokensDirectory, { recursive: true }),
    ]);

    const darkContent = getThemeContent(content.dark);
    const lightContent = getThemeContent(content.light);
    const themesIndex = `export { ${meta.name}__dark } from './${meta.name}__dark';
export { ${meta.name}__light } from './${meta.name}__light';\n`;
    const tokensContent = [
        javaScriptTokens.color,
        javaScriptTokens.gradient,
        javaScriptTokens.shadow,
        javaScriptTokens.shape,
        javaScriptTokens.spacing,
        javaScriptTokens.typography,
        javaScriptTokens.viewContainer,
    ].join('\n');

    await Promise.all([
        writeGeneratedFile(
            themesDirectory,
            `${meta.name}__dark.ts`,
            `export const ${meta.name}__dark = [\`${darkContent}\`] as unknown as TemplateStringsArray;\n`,
        ),
        writeGeneratedFile(
            themesDirectory,
            `${meta.name}__light.ts`,
            `export const ${meta.name}__light = [\`${lightContent}\`] as unknown as TemplateStringsArray;\n`,
        ),
        writeGeneratedFile(themesDirectory, 'index.ts', themesIndex),
        writeGeneratedFile(cssDirectory, `${meta.name}__dark.css`, darkContent, CSS_ROBO_COMMENT),
        writeGeneratedFile(cssDirectory, `${meta.name}__light.css`, lightContent, CSS_ROBO_COMMENT),
        writeGeneratedFile(cssDirectory, `${meta.name}.module.css`, createModuleContent(content), CSS_ROBO_COMMENT),
        writeGeneratedFile(tokensDirectory, 'index.ts', tokensContent),
        writeFile(
            join(outputDirectory, 'index.ts'),
            `${ROBO_COMMENT}
    export * from './themes';
    export * from './tokens';
    `,
            'utf8',
        ),
    ]);
}
