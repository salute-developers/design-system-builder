import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Breakpoint } from './generator/themeBuilder/types/constants.ts';
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
    /** Экраны адаптивной типографики в порядке вывода. */
    breakpoints: Breakpoint[];
}

/** Имя темы становится идентификатором в коде: `export { <имя>__dark }`. */
const THEME_NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;

/**
 * Латиница для русских букв, близкая к ICAO, без диакритики и апострофов. Таблица — часть контракта:
 * её изменение переименует экспорты уже сгенерированных тем.
 */
const LOWERCASE_TRANSLITERATION: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
};

/** Та же таблица и заглавные буквы: `Щ` → `Shch`. */
const TRANSLITERATION: Record<string, string> = Object.fromEntries(
    Object.entries(LOWERCASE_TRANSLITERATION).flatMap(([letter, latin]) => [
        [letter, latin],
        [letter.toUpperCase(), latin.charAt(0).toUpperCase() + latin.slice(1)],
    ]),
);

/**
 * Приводит имя темы к идентификатору JavaScript: русские буквы — латиницей, остальные недопустимые
 * символы — одним `_`, без `_` по краям. Подходящее имя не меняется. Возвращает undefined, если
 * идентификатор не получается: имя пустое или начинается с цифры.
 */
export function toThemeIdentifier(name: string): string | undefined {
    if (THEME_NAME_PATTERN.test(name)) {
        return name;
    }
    const identifier = Array.from(name, (letter) => TRANSLITERATION[letter] ?? letter)
        .join('')
        .replace(/[^\w$]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return THEME_NAME_PATTERN.test(identifier) ? identifier : undefined;
}

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
 * в имена файлов и экспортов, поэтому приводится к идентификатору и не должно повторяться.
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

    const sameNameByKey = new Map<string, { tenant: string; name: string; original: string }>();
    const named = themes.map(({ meta, variations }, index) => {
        const { tenant } = paths.themes[index];
        const name = typeof meta.name === 'string' ? toThemeIdentifier(meta.name) : undefined;
        if (name === undefined) {
            throw new Error(
                `Theme "${tenant}" has the name "${meta.name}" in meta.json, which cannot be turned into ` +
                    'a JavaScript identifier: it must start with a Latin or Russian letter, "_" or "$".',
            );
        }
        if (name !== meta.name) {
            console.warn(`Theme "${tenant}": name "${meta.name}" in meta.json is used as "${name}".`);
        }
        // Без учёта регистра: имя становится именем файла, а файловая система может регистр не различать.
        const key = name.toLowerCase();
        const sameName = sameNameByKey.get(key);
        if (sameName !== undefined) {
            // Исходное имя показывается, только если тема получила другое.
            const original = (theme: { name: string; original: string }) =>
                theme.original === theme.name ? '' : ` ("${theme.original}")`;
            throw new Error(
                `Themes "${sameName.tenant}"${original(sameName)} and "${tenant}"` +
                    `${original({ name, original: meta.name })} have the same name "${name}" in meta.json.`,
            );
        }
        sameNameByKey.set(key, { tenant, name, original: meta.name });
        return { meta: { ...meta, name }, variations };
    });

    return {
        palette,
        themes: named,
        defaultThemeName: named[paths.themes.indexOf(paths.defaultTheme)].meta.name,
        breakpoints: paths.breakpoints,
    };
}
