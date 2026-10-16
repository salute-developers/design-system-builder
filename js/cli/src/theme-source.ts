import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ThemeSource as GeneratorThemeSource } from './generator/themeBuilder/types/theme.ts';
import type { LocalThemePaths, LocalThemeSet } from './local-theme-source.ts';

export type Palette = Record<string, Record<string, string>>;
type ThemeMeta = GeneratorThemeSource['meta'];
type ThemeVariations = GeneratorThemeSource['variations'];

/** Данные одной темы. */
export interface ThemeSource {
    meta: ThemeMeta;
    variations: ThemeVariations;
}

/** Темы одной дизайн-системы с общей палитрой. */
export interface ThemeSetSource {
    palette: Palette;
    /** Темы в порядке генерации. */
    themes: ThemeSource[];
    /** Имя темы (из её meta.json), из которой берутся запасные значения токенов. */
    defaultThemeName: string;
}

/** Имя темы становится идентификатором в коде: `export { <имя>__dark }`. */
const THEME_NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;

/** Читает JSON в UTF-8; тип T описывает ожидаемые данные, но не проверяет их структуру. */
const readJson = async <T>(path: string) => JSON.parse(await readFile(path, 'utf8')) as T;

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

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

/** Метаданные и web-значения одной темы; отсутствующие данные называют тему. */
async function readTheme(paths: LocalThemePaths): Promise<ThemeSource> {
    try {
        const [meta, variations] = await Promise.all([
            readJson<ThemeMeta>(paths.meta),
            readVariations(paths.variations),
        ]);
        if (variations.color === undefined) {
            throw new Error(`web_color.json is missing`);
        }
        return { meta, variations };
    } catch (error) {
        const reason = isMissing(error) ? 'expected meta.json and web values' : (error as Error).message;
        throw new Error(`Theme "${paths.tenant}" has no usable data in ${paths.directory}: ${reason}.`);
    }
}

/**
 * Загружает все темы и палитру и проверяет имена тем до генерации: имя из meta.json попадает
 * в имена файлов и экспортов, поэтому должно быть идентификатором и не повторяться.
 */
export async function readThemeSetSource(paths: LocalThemeSet): Promise<ThemeSetSource> {
    const palette = await readJson<Palette>(paths.palette).catch((error) => {
        throw new Error(
            isMissing(error)
                ? `Palette is missing: ${paths.palette}.`
                : `Cannot read palette ${paths.palette}: ${(error as Error).message}`,
        );
    });
    const themes = await Promise.all(paths.themes.map(readTheme));

    const tenantByThemeName = new Map<string, string>();
    themes.forEach(({ meta }, index) => {
        const { tenant } = paths.themes[index];
        if (typeof meta.name !== 'string' || !THEME_NAME_PATTERN.test(meta.name)) {
            throw new Error(
                `Theme "${tenant}" has the name "${meta.name}" in meta.json, which is not a valid JavaScript identifier.`,
            );
        }
        // Без учёта регистра: имя становится именем файла, а файловая система может регистр не различать.
        const key = meta.name.toLowerCase();
        const sameName = tenantByThemeName.get(key);
        if (sameName !== undefined) {
            throw new Error(`Themes "${sameName}" and "${tenant}" have the same name "${meta.name}" in meta.json.`);
        }
        tenantByThemeName.set(key, tenant);
    });

    return {
        palette,
        themes,
        defaultThemeName: themes[paths.themes.indexOf(paths.defaultTheme)].meta.name,
    };
}
