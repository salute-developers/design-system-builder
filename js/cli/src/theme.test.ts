import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { generateThemes } from './generate-theme.ts';
import { resolveLocalThemes } from './local-theme-source.ts';
import { readThemeSetSource } from './theme-source.ts';

// Сервис генерации использует CommonJS, поэтому подключаем его через require из ES-модуля.
const { generate } = createRequire(import.meta.url)('../../services/generator/app/themeBuilder/index.ts') as
    typeof import('../../services/generator/app/themeBuilder/index.ts');

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

    it('отклоняет имя, непригодное как идентификатор', async () => {
        await writeTheme(themeDirectory('dashed'), 'brand-dashed', '#111111FF');

        await assert.rejects(readThemes(), /Theme "dashed" has the name "brand-dashed".*not a valid JavaScript identifier/);
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

describe('themeBuilder.generate для сервиса генерации', () => {
    it('пишет одну тему с прежним составом: имена файлов из meta.json, один индекс, один файл токенов', async () => {
        const [source] = (await readThemes({ tenant: 'brand_light' })).themes;
        const directory = join(root, 'service-theme');

        // Сервис передаёт имя пакета, отличное от имени темы: в файлы идёт имя из meta.json.
        await generate([{ name: 'package-name', version: '1.0.0' }], source, directory);

        assert.deepEqual((await readdir(join(directory, 'themes'))).sort(), [
            'brand_light__dark.ts',
            'brand_light__light.ts',
            'index.ts',
        ]);
        assert.deepEqual((await readdir(join(directory, 'css'))).sort(), [
            'brand_light.module.css',
            'brand_light__dark.css',
            'brand_light__light.css',
        ]);
        const index = await readFile(join(directory, 'themes', 'index.ts'), 'utf8');
        assert.equal(
            index.replace(/^\/\/.*\n+/, ''),
            "export { brand_light__dark } from './brand_light__dark';\nexport { brand_light__light } from './brand_light__light';\n",
        );
        const tokens = await readFile(join(directory, 'tokens', 'index.ts'), 'utf8');
        assert.equal(tokens.match(/export const textPrimary = 'var\(--text-primary, #FFFFFFFF\)';/g)?.length, 1);
        assert.match(await readFile(join(directory, 'index.ts'), 'utf8'), /export \* from '.\/themes';/);
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
