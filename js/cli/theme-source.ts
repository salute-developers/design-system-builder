import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ThemeSource as GeneratorThemeSource } from '../services/generator/app/themeBuilder/types/theme.ts';

type Palette = Record<string, Record<string, string>>;
type ThemeMeta = GeneratorThemeSource['meta'];
type ThemeVariations = GeneratorThemeSource['variations'];

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

/** Читает JSON в UTF-8; тип T описывает ожидаемые данные, но не проверяет их структуру. */
const readJson = async <T>(path: string) => JSON.parse(await readFile(path, 'utf8')) as T;

/** Собирает JSON-файлы каталога в объект вариаций: например, web_color.json становится полем color. */
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

/** Параллельно загружает метаданные, палитру и вариации темы из локальных файлов. */
export async function readThemeSource(paths: ThemeSourcePaths): Promise<ThemeSource> {
    const [meta, palette, variations] = await Promise.all([
        readJson<ThemeMeta>(paths.meta),
        readJson<Palette>(paths.palette),
        readVariations(paths.variations),
    ]);

    return { meta, palette, variations };
}

/** Превращает данные в текст JavaScript-модуля с именованной константой и экспортом по умолчанию. */
const createJavaScriptModule = (name: string, value: unknown) =>
    `const ${name} = ${JSON.stringify(value, null, 4)};\n\nexport default ${name};\n`;

/**
 * Сохраняет метаданные и вариации в meta.js и variations.js и возвращает пути к ним.
 * Каталог назначения должен уже существовать; палитра в эти модули не записывается.
 */
export async function writeThemeSourceModules(source: ThemeSource, outputDirectory: string) {
    const metaPath = join(outputDirectory, 'meta.js');
    const variationsPath = join(outputDirectory, 'variations.js');

    await Promise.all([
        writeFile(metaPath, createJavaScriptModule('meta', source.meta), 'utf8'),
        writeFile(variationsPath, createJavaScriptModule('variations', source.variations), 'utf8'),
    ]);

    return [metaPath, variationsPath];
}
