import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Palette, ThemeMeta, ThemeVariations } from './theme-builder/types.ts';

interface ThemeSourcePaths {
    meta: string;
    palette: string;
    variations: string;
}

export interface ThemeSource {
    meta: ThemeMeta;
    palette: Palette;
    variations: ThemeVariations;
}

const readJson = async <T>(path: string) => JSON.parse(await readFile(path, 'utf8')) as T;

const readVariations = async (directory: string) => {
    const fileNames = (await readdir(directory)).filter((fileName) => fileName.endsWith('.json')).sort();
    const entries = await Promise.all(
        fileNames.map(async (fileName) => {
            const key = fileName.replace(/^web_/, '').replace(/\.json$/, '');
            return [key, await readJson<unknown>(join(directory, fileName))] as const;
        }),
    );

    return Object.fromEntries(entries) as unknown as ThemeVariations;
};

export async function readThemeSource(paths: ThemeSourcePaths): Promise<ThemeSource> {
    const [meta, palette, variations] = await Promise.all([
        readJson<ThemeMeta>(paths.meta),
        readJson<Palette>(paths.palette),
        readVariations(paths.variations),
    ]);

    return { meta, palette, variations };
}

const createJavaScriptModule = (name: string, value: unknown) =>
    `const ${name} = ${JSON.stringify(value, null, 4)};\n\nexport default ${name};\n`;

export async function writeThemeSourceModules(source: ThemeSource, outputDirectory: string) {
    const metaPath = join(outputDirectory, 'meta.js');
    const variationsPath = join(outputDirectory, 'variations.js');

    await Promise.all([
        writeFile(metaPath, createJavaScriptModule('meta', source.meta), 'utf8'),
        writeFile(variationsPath, createJavaScriptModule('variations', source.variations), 'utf8'),
    ]);

    return [metaPath, variationsPath];
}
