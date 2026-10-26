import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { SCREEN_NAMES, webBreakpoints } from './generator/themeBuilder/types/constants.ts';
import type { Breakpoint, ScreenName } from './generator/themeBuilder/types/constants.ts';

interface LocalConfig {
    tenants?: { name: string; directoryPath?: string }[];
    palettePath?: string;
    breakpoints?: unknown;
}

/** Расположение данных одной темы. */
export interface LocalThemePaths {
    /** Имя темы для сообщений: имя из config.json или имя каталога. */
    tenant: string;
    directory: string;
    meta: string;
    variations: string;
}

export interface LocalThemeSet {
    palette: string;
    /** Темы в порядке генерации: по имени каталога. */
    themes: LocalThemePaths[];
    /** Тема, из которой берутся запасные значения токенов; без `defaultTenant` — первая. */
    defaultTheme: LocalThemePaths;
    /** Экраны адаптивной типографики: из config.json, без него — `webBreakpoints`. */
    breakpoints: Breakpoint[];
}

const META_FILE_NAME = 'meta.json';

const exists = async (path: string) => (await stat(path).catch(() => null)) !== null;

/** config.json необязателен: набор тем определяют каталоги, а не список в нём. */
async function readConfig(sddsDirectory: string): Promise<LocalConfig | null> {
    const configPath = join(sddsDirectory, 'config.json');
    if (!(await exists(configPath))) {
        return null;
    }
    try {
        const config = JSON.parse(await readFile(configPath, 'utf8')) as LocalConfig;
        return { ...config, tenants: Array.isArray(config.tenants) ? config.tenants : [] };
    } catch (error) {
        throw new Error(`Cannot read ${configPath}: ${(error as Error).message}`);
    }
}

const isBound = (value: unknown): value is number | null | undefined =>
    value === undefined || value === null || (Number.isInteger(value) && (value as number) >= 0);

/**
 * Разбирает `breakpoints` из config.json и проверяет, что у сетки есть начало и конец: у первого экрана
 * только `to` (максимальная ширина), у последнего только `from` (минимальная), у остальных обе. Стыковка соседних
 * экранов не проверяется. Единственный экран границ не имеет. Имена идут в порядке `screenS`, `screenM`,
 * `screenL`, пропуск экрана допустим.
 */
export function parseBreakpoints(value: unknown, configPath: string): Breakpoint[] {
    const fail = (message: string): never => {
        throw new Error(`Invalid breakpoints in ${configPath}: ${message}`);
    };
    if (!Array.isArray(value) || value.length === 0) {
        return fail('expected a non-empty array of screens.');
    }

    const breakpoints = value.map((item: unknown, index): Breakpoint => {
        const at = `breakpoints[${index}]`;
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            return fail(`${at} must be an object.`);
        }
        const { name, from, to } = item as Record<string, unknown>;
        if (!SCREEN_NAMES.includes(name as ScreenName)) {
            return fail(`${at}.name must be one of ${SCREEN_NAMES.join(', ')}, got ${JSON.stringify(name)}.`);
        }
        if (!isBound(from) || !isBound(to)) {
            return fail(`${at} bounds "from" and "to" must be non-negative integers.`);
        }
        return { name: name as ScreenName, from: from ?? undefined, to: to ?? undefined };
    });

    breakpoints.forEach(({ name }, index) => {
        if (index > 0 && SCREEN_NAMES.indexOf(name) <= SCREEN_NAMES.indexOf(breakpoints[index - 1].name)) {
            fail(
                `breakpoints[${index}] "${name}" must follow "${breakpoints[index - 1].name}" in the order ${SCREEN_NAMES.join(', ')}.`,
            );
        }
    });

    if (breakpoints.length === 1) {
        const [{ name, from, to }] = breakpoints;
        if (from !== undefined || to !== undefined) {
            fail(`the only screen "${name}" covers every width and must have neither "from" nor "to".`);
        }
        return breakpoints;
    }

    breakpoints.forEach(({ name, from, to }, index) => {
        const at = `breakpoints[${index}] "${name}"`;
        if (index === 0) {
            if (to === undefined || from !== undefined) {
                fail(`${at} is the first screen and must have only "to" (its maximum width).`);
            }
        } else if (index === breakpoints.length - 1) {
            if (from === undefined || to !== undefined) {
                fail(`${at} is the last screen and must have only "from" (its minimum width).`);
            }
        } else if (from === undefined || to === undefined || from > to) {
            fail(`${at} must have both "from" and "to" with "from" not greater than "to".`);
        }
    });

    return breakpoints;
}

/** Каталог нормализуется, чтобы темы можно было сравнивать по нему. */
const themePaths = (tenant: string, path: string): LocalThemePaths => {
    const directory = resolve(path);
    return { tenant, directory, meta: join(directory, META_FILE_NAME), variations: join(directory, 'web') };
};

/**
 * Находит темы для генерации.
 *
 * Без `tenant` — все темы из `<sdds>/tenants`: темой считается каталог с `meta.json`, остальное
 * (пустой каталог удалённой темы, скрытый каталог, `palette.json`) пропускается. С `tenant` — одна тема: сначала
 * по имени в config.json с её `directoryPath`, затем по имени каталога в `<sdds>/tenants`.
 * `defaultTenant` ищется так же и должен входить в набор.
 */
export async function resolveLocalThemes(
    sddsDirectory: string,
    { tenant, defaultTenant }: { tenant?: string; defaultTenant?: string } = {},
): Promise<LocalThemeSet> {
    const config = await readConfig(sddsDirectory);
    const breakpoints =
        config?.breakpoints == null
            ? webBreakpoints
            : parseBreakpoints(config.breakpoints, join(sddsDirectory, 'config.json'));
    const tenantsDirectory = join(sddsDirectory, 'tenants');

    // Пути с префиксом .sdds/ привязываем к выбранному каталогу --sdds, чтобы данные
    // можно было переносить. Остальные относительные пути считаем от его родителя.
    const resolveConfigPath = (path: string) => {
        const portablePath = path.replace(/^\.\//, '');
        return portablePath.startsWith('.sdds/')
            ? resolve(sddsDirectory, portablePath.slice('.sdds/'.length))
            : resolve(dirname(sddsDirectory), path);
    };

    const findTheme = async (name: string, option: string): Promise<LocalThemePaths> => {
        if (name === '') {
            throw new Error(`${option} requires a theme name.`);
        }
        const configured = config?.tenants?.find((candidate) => candidate.name === name);
        if (configured) {
            return themePaths(
                name,
                configured.directoryPath ? resolveConfigPath(configured.directoryPath) : join(tenantsDirectory, name),
            );
        }
        const directory = join(tenantsDirectory, name);
        if (!(await exists(join(directory, META_FILE_NAME)))) {
            throw new Error(
                `Unknown ${option} "${name}": it is neither a tenant in config.json nor a theme directory in ${tenantsDirectory}.`,
            );
        }
        return themePaths(name, directory);
    };

    const findAllThemes = async (): Promise<LocalThemePaths[]> => {
        const entries = await readdir(tenantsDirectory, { withFileTypes: true }).catch(() => []);
        // Скрытые каталоги темами не считаются: от порядка имён зависит тема по умолчанию.
        const names = entries
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .map((entry) => entry.name)
            .sort();
        const themes: LocalThemePaths[] = [];
        for (const name of names) {
            if (await exists(join(tenantsDirectory, name, META_FILE_NAME))) {
                themes.push(themePaths(name, join(tenantsDirectory, name)));
            }
        }
        if (themes.length === 0) {
            throw new Error(`No themes found in ${tenantsDirectory}: a theme is a directory with ${META_FILE_NAME}.`);
        }
        return themes;
    };

    const themes = tenant === undefined ? await findAllThemes() : [await findTheme(tenant, '--tenant')];

    let defaultTheme = themes[0];
    if (defaultTenant !== undefined) {
        const requested = await findTheme(defaultTenant, '--default-tenant');
        const generated = themes.find(({ directory }) => directory === requested.directory);
        if (!generated) {
            throw new Error(
                `--default-tenant "${defaultTenant}" is not among the generated themes: ${themes
                    .map((theme) => theme.tenant)
                    .join(', ')}.`,
            );
        }
        defaultTheme = generated;
    }

    return {
        palette: config?.palettePath ? resolveConfigPath(config.palettePath) : join(tenantsDirectory, 'palette.json'),
        themes,
        defaultTheme,
        breakpoints,
    };
}
