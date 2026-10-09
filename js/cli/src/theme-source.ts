import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ThemeSource as GeneratorThemeSource } from '../../services/generator/app/themeBuilder/types/theme.ts';

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
