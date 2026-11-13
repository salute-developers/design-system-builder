import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { cliDirectory } from './package-output.ts';

const bin = join(cliDirectory, 'bin', 'dsbuilder-web-generator.js');

let root: string;

const writeJson = async (path: string, value: unknown) => {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, JSON.stringify(value));
};

/** Минимальная `.sdds` с одной темой: генерации темы этого достаточно. */
const writeSdds = async (sdds: string) => {
    await writeJson(join(sdds, 'tenants', 'palette.json'), { gray: { '1000': '#000000' } });
    const theme = join(sdds, 'tenants', 'brand');
    await writeJson(join(theme, 'meta.json'), {
        name: 'brand',
        version: 'latest',
        tokens: ['dark', 'light'].map((mode) => ({
            type: 'color',
            name: `${mode}.text.default.primary`,
            tags: [mode, 'text', 'default', 'primary'],
            displayName: 'textPrimary',
            description: 'Основной цвет текста',
            enabled: true,
        })),
    });
    await writeJson(join(theme, 'web', 'web_color.json'), {
        'dark.text.default.primary': '#FFFFFFFF',
        'light.text.default.primary': '#080808FF',
    });
    for (const kind of ['gradient', 'shape', 'spacing', 'shadow', 'typography', 'fontFamily']) {
        await writeJson(join(theme, 'web', `web_${kind}.json`), {});
    }
};

/** Запуск без `NPM_PACKAGE_SCOPE`: так его видит пользователь глобальной установки. */
const run = (command: string, args: string[], cwd: string) => {
    const env = { ...process.env };
    delete env.NPM_PACKAGE_SCOPE;
    return spawnSync(command, args, { cwd, env, encoding: 'utf8' });
};

/** Все файлы каталога с содержимым, по относительным путям. */
const snapshot = async (directory: string): Promise<Record<string, string>> => {
    const files: Record<string, string> = {};
    const walk = async (current: string) => {
        for (const entry of await readdir(current, { withFileTypes: true })) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) await walk(path);
            else files[relative(directory, path)] = await readFile(path, 'utf8');
        }
    };
    await walk(directory);
    return files;
};

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dsbuilder-web-bin-'));
    await writeSdds(join(root, '.sdds'));
});

afterEach(() => rm(root, { recursive: true, force: true }));

describe('dsbuilder-web-generator', () => {
    it('печатает версию пакета', async () => {
        const { version } = JSON.parse(await readFile(join(cliDirectory, 'package.json'), 'utf8'));
        const result = run(process.execPath, [bin, '--version'], root);

        assert.equal(result.status, 0);
        assert.equal(result.stdout, `${version}\n`);
    });

    it('без команды и с неизвестной командой печатает список команд и завершается ошибкой', () => {
        for (const args of [[], ['publish']]) {
            const result = run(process.execPath, [bin, ...args], root);

            assert.equal(result.status, 2);
            assert.match(result.stderr, /Commands:[\s\S]*theme[\s\S]*components[\s\S]*ds/);
        }
        assert.match(run(process.execPath, [bin, 'publish'], root).stderr, /Unknown command: publish/);
    });

    it('theme пишет то же, что npm run generate:theme, и берёт scope @sddsjs без переменной', async () => {
        const sdds = join(root, '.sdds');
        const fromBin = run(
            process.execPath,
            [bin, 'theme', '--sdds', sdds, '--out', join(root, 'bin'), '--package', '--name', 'base'],
            root,
        );
        assert.equal(fromBin.status, 0, fromBin.stderr);
        const fromScript = run(
            process.execPath,
            ['--import', 'tsx', join(cliDirectory, 'src', 'theme.ts'), '--sdds', sdds, '--out', join(root, 'script'), '--package', '--name', 'base'],
            cliDirectory,
        );
        assert.equal(fromScript.status, 0, fromScript.stderr);

        assert.deepEqual(await snapshot(join(root, 'bin')), await snapshot(join(root, 'script')));
        assert.equal(JSON.parse(await readFile(join(root, 'bin', 'package.json'), 'utf8')).name, '@sddsjs/base');
    });

    it('без --sdds и --out читает ./.sdds и пишет в ./output текущего каталога', async () => {
        const result = run(process.execPath, [bin, 'theme'], root);

        assert.equal(result.status, 0, result.stderr);
        assert.ok((await readdir(join(root, 'output', 'src'))).includes('theme'));
    });

    it('ошибка генерации даёт ненулевой код', () => {
        const result = run(process.execPath, [bin, 'theme', '--sdds', join(root, 'missing')], root);

        assert.equal(result.status, 1);
        assert.match(result.stderr, /Failed to generate theme/);
    });
});
