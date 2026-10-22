import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

// `utils` генератора требует scope пакета при импорте; скрипты берут его из js/.env, тест задаёт сам.
process.env.NPM_PACKAGE_SCOPE ??= '@test-scope';
const { cliDirectory, writePackagePart } = await import('./package-output.ts');

let output: string;

const writeText = async (path: string, text: string) => {
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, text);
};

/** Тема-заглушка: генератор пакета знает только каталог `src/<часть>`. */
const fillTheme = async (pathToDir: string) => writeText(join(pathToDir, 'src', 'theme', 'index.ts'), 'export {};\n');

const write = (pack: boolean, packageName?: string) =>
    writePackagePart({
        parts: ['theme'],
        outputDirectory: output,
        packageName,
        packageVersion: '1.2.3',
        coreVersion: 'latest',
        pack,
        fill: fillTheme,
    });

/** Код выхода и stderr процесса; зависший процесс убивается по таймауту, и тест падает. */
const runWithOpenStdin = (command: string, cwd: string, timeoutMs: number) =>
    new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
        // stdin остаётся открытым, как у терминала: команда, которая читает stdin, зависнет.
        const child = spawn(command, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => (stderr += chunk));
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`${command} did not exit within ${timeoutMs} ms; stderr: ${stderr}`));
        }, timeoutMs);
        child.on('error', reject);
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, stderr });
        });
    });

const temporaryDirectories = async () => (await readdir(cliDirectory)).filter((name) => name.startsWith('result-'));

beforeEach(async () => {
    output = join(await mkdtemp(join(tmpdir(), 'dsbuilder-package-')), 'output');
    // Прежний результат: часть, которой нет в новом пакете, свой package.json и установленные зависимости.
    await writeText(join(output, 'src', 'components', 'Button', 'index.ts'), 'export {};\n');
    await writeText(join(output, 'package.json'), '{ "name": "old" }');
    await writeText(join(output, 'node_modules', 'kept', 'index.js'), '');
});

afterEach(() => rm(join(output, '..'), { recursive: true, force: true }));

describe('writePackagePart', () => {
    it('с --package пишет папку пакета без сборки и архива', async () => {
        const before = await temporaryDirectories();

        assert.equal(await write(true, 'brand'), output);

        const files = await readdir(output);
        for (const file of [
            'package.json',
            'rollup.config.mjs',
            'babel.config.js',
            'tsconfig.json',
            'scripts',
            'src',
        ]) {
            assert.ok(files.includes(file), `${file} is missing`);
        }
        assert.ok(!files.some((file) => file.endsWith('.tgz')));
        const packageJson = JSON.parse(await readFile(join(output, 'package.json'), 'utf8'));
        assert.equal(packageJson.name, `${process.env.NPM_PACKAGE_SCOPE}/brand`);
        assert.equal(packageJson.version, '1.2.3');
        // src — ровно части нового пакета; прочее содержимое output остаётся.
        assert.deepEqual((await readdir(join(output, 'src'))).sort(), ['index.ts', 'theme']);
        assert.ok((await readdir(output)).includes('node_modules'));
        assert.deepEqual(await temporaryDirectories(), before);
    });

    it('без --package заменяет только свою часть', async () => {
        await write(false);

        assert.deepEqual((await readdir(join(output, 'src'))).sort(), ['components', 'index.ts', 'theme']);
        assert.equal(await readFile(join(output, 'package.json'), 'utf8'), '{ "name": "old" }');
    });

    it('пакет из одной темы проходит copy-linaria-components без ввода из терминала', async () => {
        await write(true, 'brand');

        const { code, stderr } = await runWithOpenStdin('./scripts/copy-linaria-components.sh', output, 10_000);

        assert.equal(code, 0, stderr);
        assert.doesNotMatch(stderr, /No such file or directory/);
        assert.doesNotMatch(stderr, /reading from STDIN/);
    });

    it('с --package требует --name до генерации', async () => {
        await assert.rejects(write(true), /--name is required with --package/);

        assert.equal(await readFile(join(output, 'package.json'), 'utf8'), '{ "name": "old" }');
    });
});
