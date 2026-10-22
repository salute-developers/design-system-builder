import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { generateThemes, toGeneratorThemeSource } from './generate-theme.ts';
import { resolveLocalThemes } from './local-theme-source.ts';
import { readThemeSetSource, toThemeIdentifier } from './theme-source.ts';

let root: string;
let sdds: string;

const writeJson = async (path: string, value: unknown) => {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, JSON.stringify(value));
};

const colorToken = (name: string) => ({
    type: 'color',
    name,
    tags: name.split('.'),
    displayName: 'textPrimary',
    description: 'Основной цвет текста',
    enabled: true,
});

/** Минимальная тема: один цвет в тёмном и светлом режиме; `directory` — каталог темы. */
const writeTheme = async (directory: string, themeName: string, darkColor: string) => {
    await writeJson(join(directory, 'meta.json'), {
        name: themeName,
        version: 'latest',
        tokens: [colorToken('dark.text.default.primary'), colorToken('light.text.default.primary')],
    });
    await writeJson(join(directory, 'web', 'web_color.json'), {
        'dark.text.default.primary': darkColor,
        'light.text.default.primary': '#080808FF',
    });
    for (const kind of ['gradient', 'shape', 'spacing', 'shadow', 'typography', 'fontFamily']) {
        await writeJson(join(directory, 'web', `web_${kind}.json`), {});
    }
};

const themeDirectory = (name: string) => join(sdds, 'tenants', name);

const readThemes = (options?: { tenant?: string; defaultTenant?: string }) =>
    resolveLocalThemes(sdds, options).then(readThemeSetSource);

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dsbuilder-web-theme-'));
    sdds = join(root, '.sdds');
    await writeJson(join(sdds, 'tenants', 'palette.json'), { gray: { '1000': '#000000' } });
    await writeTheme(themeDirectory('brand_night'), 'brand_night', '[general.gray.1000][0.5]');
    await writeTheme(themeDirectory('brand_light'), 'brand_light', '#FFFFFFFF');
    // Каталог удалённой темы: theme fetch стирает данные, каталог остаётся.
    await mkdir(join(themeDirectory('removed'), 'web'), { recursive: true });
});

afterEach(() => rm(root, { recursive: true, force: true }));

describe('resolveLocalThemes', () => {
    it('находит все темы по каталогам в порядке имён и не требует config.json', async () => {
        const { themes, defaultTheme, palette } = await resolveLocalThemes(sdds);

        assert.deepEqual(themes.map((theme) => theme.tenant), ['brand_light', 'brand_night']);
        assert.equal(defaultTheme.tenant, 'brand_light');
        assert.equal(palette, join(sdds, 'tenants', 'palette.json'));
    });

    it('с --tenant берёт тему по имени из config.json с её directoryPath', async () => {
        await writeTheme(join(root, 'elsewhere'), 'moved', '#111111FF');
        await writeJson(join(sdds, 'config.json'), {
            tenants: [{ name: 'Brand Moved', directoryPath: 'elsewhere' }],
        });

        const { themes } = await resolveLocalThemes(sdds, { tenant: 'Brand Moved' });

        assert.deepEqual(themes.map((theme) => theme.directory), [join(root, 'elsewhere')]);
    });

    it('с --tenant берёт каталог, когда имени нет в config.json', async () => {
        await writeJson(join(sdds, 'config.json'), { tenants: [] });

        const { themes } = await resolveLocalThemes(sdds, { tenant: 'brand_night' });

        assert.deepEqual(themes.map((theme) => theme.directory), [themeDirectory('brand_night')]);
    });

    it('читает палитру из palettePath в config.json', async () => {
        await writeJson(join(sdds, 'config.json'), { palettePath: '.sdds/shared/palette.json' });

        assert.equal((await resolveLocalThemes(sdds)).palette, join(sdds, 'shared', 'palette.json'));
    });

    it('пропускает скрытые каталоги и отклоняет пустое имя темы', async () => {
        await writeTheme(themeDirectory('.cache'), 'cache', '#111111FF');

        assert.deepEqual((await resolveLocalThemes(sdds)).themes.map((theme) => theme.tenant), [
            'brand_light',
            'brand_night',
        ]);
        await assert.rejects(resolveLocalThemes(sdds, { tenant: '' }), /--tenant requires a theme name/);
    });

    it('называет файл, когда config.json не разбирается', async () => {
        await mkdir(sdds, { recursive: true });
        await writeFile(join(sdds, 'config.json'), '{ broken');

        await assert.rejects(resolveLocalThemes(sdds), /Cannot read .*config\.json/);
    });

    it('находит тему по умолчанию по имени из config.json и по каталогу с завершающим слэшем', async () => {
        await writeJson(join(sdds, 'config.json'), {
            tenants: [{ name: 'Night', directoryPath: '.sdds/tenants/brand_night/' }],
        });

        assert.equal((await resolveLocalThemes(sdds, { defaultTenant: 'Night' })).defaultTheme.tenant, 'brand_night');
        assert.equal(
            (await resolveLocalThemes(sdds, { tenant: 'brand_night', defaultTenant: 'Night' })).defaultTheme.directory,
            themeDirectory('brand_night'),
        );
    });

    it('отклоняет неизвестное имя темы', async () => {
        await assert.rejects(resolveLocalThemes(sdds, { tenant: 'missing' }), /Unknown --tenant "missing"/);
        await assert.rejects(resolveLocalThemes(sdds, { tenant: 'removed' }), /Unknown --tenant "removed"/);
    });

    it('сообщает путь, когда тем нет', async () => {
        await rm(themeDirectory('brand_night'), { recursive: true });
        await rm(themeDirectory('brand_light'), { recursive: true });

        await assert.rejects(resolveLocalThemes(sdds), new RegExp(`No themes found in .*tenants`));
    });

    it('отклоняет тему по умолчанию вне набора', async () => {
        await assert.rejects(
            resolveLocalThemes(sdds, { tenant: 'brand_night', defaultTenant: 'brand_light' }),
            /--default-tenant "brand_light" is not among the generated themes: brand_night/,
        );
        await assert.rejects(resolveLocalThemes(sdds, { defaultTenant: 'missing' }), /Unknown --default-tenant/);
    });
});

describe('readThemeSetSource', () => {
    it('отклоняет совпадающие имена тем', async () => {
        await writeTheme(themeDirectory('copy'), 'brand_night', '#111111FF');

        await assert.rejects(readThemes(), /Themes "brand_night" and "copy" have the same name "brand_night"/);
    });

    it('приводит имя к идентификатору и сообщает об этом', async (context) => {
        const warn = context.mock.method(console, 'warn', () => {});
        await writeTheme(themeDirectory('dashed'), 'brand-dashed', '#111111FF');

        const { themes } = await readThemes();

        assert.deepEqual(themes.map(({ meta }) => meta.name), ['brand_light', 'brand_night', 'brand_dashed']);
        assert.deepEqual(warn.mock.calls.map((call) => call.arguments[0]), [
            'Theme "dashed": name "brand-dashed" in meta.json is used as "brand_dashed".',
        ]);
    });

    it('отклоняет имя, которое не приводится к идентификатору', async () => {
        await writeTheme(themeDirectory('digits'), '2025-theme', '#111111FF');

        await assert.rejects(
            readThemes(),
            /Theme "digits" has the name "2025-theme".*cannot be turned into a JavaScript identifier/,
        );
    });

    it('отклоняет имена, совпавшие после приведения, и называет исходные', async (context) => {
        context.mock.method(console, 'warn', () => {});
        await writeTheme(themeDirectory('dashed'), 'brand-night', '#111111FF');

        await assert.rejects(
            readThemes(),
            /Themes "brand_night" and "dashed" \("brand-night"\) have the same name "brand_night"/,
        );
    });

    it('считает тему по умолчанию по приведённому имени', async (context) => {
        context.mock.method(console, 'warn', () => {});
        await writeTheme(themeDirectory('brand_light'), 'Светлая тема', '#FFFFFFFF');

        const { defaultThemeName } = await readThemes();

        assert.equal(defaultThemeName, 'Svetlaya_tema');
    });

    it('отклоняет имена, различающиеся только регистром', async () => {
        await writeTheme(themeDirectory('upper'), 'Brand_Night', '#111111FF');

        await assert.rejects(readThemes(), /Themes "brand_night" and "upper" have the same name/);
    });

    it('называет тему без файла цветов', async () => {
        await rm(join(themeDirectory('brand_night'), 'web', 'web_color.json'));

        await assert.rejects(readThemes(), /Theme "brand_night" has no usable data.*web_color\.json is missing/);
    });

    it('называет тему без web-значений', async () => {
        await rm(join(themeDirectory('brand_night'), 'web'), { recursive: true });

        await assert.rejects(readThemes(), /Theme "brand_night" has no usable data/);
    });

    it('сообщает об отсутствующей палитре', async () => {
        await rm(join(sdds, 'tenants', 'palette.json'));

        await assert.rejects(readThemes(), /Palette is missing/);
    });
});

describe('toThemeIdentifier', () => {
    it('не меняет имя, которое уже является идентификатором', () => {
        for (const name of ['brand_night', 'Brand$', '_dark', 'v2']) {
            assert.equal(toThemeIdentifier(name), name);
        }
    });

    it('заменяет разделители одним подчёркиванием и транслитерирует русские буквы', () => {
        const cases: Record<string, string> = {
            'my-theme': 'my_theme',
            'brand night': 'brand_night',
            'dark--v2': 'dark_v2',
            '-x-': 'x',
            'Тёмная тема': 'Temnaya_tema',
            'Щука': 'Shchuka',
            'объём': 'obem',
            'ЖЁЛТЫЙ': 'ZhELTYY',
        };
        for (const [name, identifier] of Object.entries(cases)) {
            assert.equal(toThemeIdentifier(name), identifier, name);
        }
    });

    it('не приводит пустое имя и имя, начинающееся с цифры', () => {
        for (const name of ['', '---', '★', '2025-theme']) {
            assert.equal(toThemeIdentifier(name), undefined, name);
        }
    });
});

describe('generateThemes', () => {
    const output = () => join(root, 'theme');
    const read = (path: string) => readFile(join(output(), path), 'utf8');

    it('пишет файлы каждой темы, общий индекс по порядку и токены первой темы', async () => {
        await generateThemes(await readThemes(), output());

        assert.deepEqual((await readdir(join(output(), 'css'))).sort(), [
            'brand_light.module.css',
            'brand_light__dark.css',
            'brand_light__light.css',
            'brand_night.module.css',
            'brand_night__dark.css',
            'brand_night__light.css',
        ]);
        assert.deepEqual((await readdir(join(output(), 'themes'))).sort(), [
            'brand_light__dark.ts',
            'brand_light__light.ts',
            'brand_night__dark.ts',
            'brand_night__light.ts',
            'index.ts',
        ]);
        const exported = [...(await read('themes/index.ts')).matchAll(/export \{ (\w+) \}/g)].map(([, name]) => name);
        assert.deepEqual(exported, ['brand_light__dark', 'brand_light__light', 'brand_night__dark', 'brand_night__light']);

        // Ссылка на палитру раскрыта вместе с прозрачностью.
        assert.match(await read('css/brand_night__dark.css'), /#00000080/i);
        assert.match(await read('css/brand_light__dark.css'), /#FFFFFFFF/i);

        const tokens = await read('tokens/index.ts');
        assert.match(tokens, /#FFFFFFFF/i);
        assert.doesNotMatch(tokens, /#00000080/i);
        assert.equal(tokens.match(/export const textPrimary\b/g)?.length, 1);
    });

    it('берёт запасные значения токенов из --default-tenant', async () => {
        await generateThemes(await readThemes({ defaultTenant: 'brand_night' }), output());

        const tokens = await read('tokens/index.ts');
        assert.match(tokens, /#00000080/i);
        assert.doesNotMatch(tokens, /#FFFFFFFF/i);
    });

    it('с --tenant пишет одну тему', async () => {
        await generateThemes(await readThemes({ tenant: 'brand_night' }), output());

        assert.deepEqual((await readdir(join(output(), 'themes'))).sort(), [
            'brand_night__dark.ts',
            'brand_night__light.ts',
            'index.ts',
        ]);
    });

    it('пишет тему под приведённым именем', async (context) => {
        context.mock.method(console, 'warn', () => {});
        await writeTheme(themeDirectory('mine'), 'my-theme', '#111111FF');

        await generateThemes(await readThemes({ tenant: 'mine' }), output());

        assert.deepEqual((await readdir(join(output(), 'css'))).sort(), [
            'my_theme.module.css',
            'my_theme__dark.css',
            'my_theme__light.css',
        ]);
        const exported = [...(await read('themes/index.ts')).matchAll(/export \{ (\w+) \}/g)].map(([, name]) => name);
        assert.deepEqual(exported, ['my_theme__dark', 'my_theme__light']);
    });

    it('повторная генерация даёт тот же результат', async () => {
        await generateThemes(await readThemes(), output());
        const first = await Promise.all(['themes/index.ts', 'tokens/index.ts'].map(read));
        await generateThemes(await readThemes(), output());

        assert.deepEqual(await Promise.all(['themes/index.ts', 'tokens/index.ts'].map(read)), first);
    });

    it('не трогает прежний результат, когда данные темы неверны', async () => {
        await generateThemes(await readThemes(), output());
        const before = await read('themes/index.ts');
        await writeJson(join(themeDirectory('brand_night'), 'web', 'web_color.json'), {
            'dark.text.default.primary': '[general.unknown.1]',
            'light.text.default.primary': '#080808FF',
        });

        await assert.rejects(readThemes().then((source) => generateThemes(source, output())), /missing from the local palette/);
        assert.equal(await read('themes/index.ts'), before);
    });
});

describe('градиентный токен из выгрузки theme fetch', () => {
    const output = () => join(root, 'theme');
    const gradientToken = (name: string) => ({ ...colorToken(name), type: 'gradient', displayName: 'surfaceAccentGradient' });
    /** Значения web после раскрытия ссылок ds-service: стоп ссылки уже HEX, сплошной член — массив из строки. */
    const WEB_GRADIENT = {
        'dark.surface.default.accent-gradient': ['linear-gradient(45deg, #1A9E32FF 0%, #04C6C9FF 99.688%)'],
        'light.surface.default.accent-gradient': ['#1A9E32FF'],
    };
    /** Сплошное значение iOS градиентного семейства приходит слоем color. */
    const IOS_GRADIENT = {
        'dark.surface.default.accent-gradient': [
            { kind: 'linear', locations: [0, 0.99688], colors: ['#1A9E32FF', '#04C6C9FF'], angle: 45 },
        ],
        'light.surface.default.accent-gradient': [{ kind: 'color', background: '#1A9E32FF' }],
    };

    it('toGeneratorThemeSource не меняет вариации градиента, в том числе слой color', () => {
        const variations = {
            color: { 'dark.text.default.primary': '#000000FF' },
            gradient: { ...WEB_GRADIENT, 'dark.surface.on-dark.accent-gradient': IOS_GRADIENT['light.surface.default.accent-gradient'] },
        };
        const source = { meta: { name: 'brand', version: 'latest', tokens: [] }, variations } as never;

        const result = toGeneratorThemeSource(source, { gray: { '1000': '#000000' } });

        assert.equal(result.variations.gradient, variations.gradient);
        assert.deepEqual(result.variations.gradient, {
            ...WEB_GRADIENT,
            'dark.surface.on-dark.accent-gradient': [{ kind: 'color', background: '#1A9E32FF' }],
        });
    });

    it('генерирует градиент и сплошной член семейства без изменения значений', async () => {
        const directory = themeDirectory('brand_night');
        await writeJson(join(directory, 'meta.json'), {
            name: 'brand_night',
            version: 'latest',
            tokens: [
                colorToken('dark.text.default.primary'),
                colorToken('light.text.default.primary'),
                gradientToken('dark.surface.default.accent-gradient'),
                gradientToken('light.surface.default.accent-gradient'),
            ],
        });
        await writeJson(join(directory, 'web', 'web_gradient.json'), WEB_GRADIENT);
        await writeJson(join(directory, 'ios', 'ios_gradient.json'), IOS_GRADIENT);

        const source = await readThemes({ tenant: 'brand_night' });
        assert.deepEqual(source.themes[0].variations.gradient, WEB_GRADIENT);
        await generateThemes(source, output());

        const dark = await readFile(join(output(), 'css', 'brand_night__dark.css'), 'utf8');
        const light = await readFile(join(output(), 'css', 'brand_night__light.css'), 'utf8');
        assert.match(dark, /--surface-accent-gradient: linear-gradient\(45deg, #1A9E32FF 0%, #04C6C9FF 99\.688%\);/);
        assert.match(light, /--surface-accent-gradient: #1A9E32FF;/);
    });
});
