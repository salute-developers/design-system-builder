import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import type { Meta } from './generator/componentBuilder/type.ts';

import { generateBaseFileStructure, generateComponentsFiles } from './generator/generate.ts';
import { DEFAULT_NPM_PACKAGE_SCOPE, resolveNpmPackageScope } from './generator/utils/index.ts';

/** Компонент без свойств и значений: генератор пишет только обёртку и берёт шаблоны из `templates/<X>`. */
const emptyComponent = (name: string) =>
    ({
        name,
        description: '',
        sources: { api: [], configs: [{ id: `${name}-default`, name: 'default', config: { variations: [] } }] },
    }) as unknown as Meta;

let pathToDir: string;

beforeEach(async () => {
    pathToDir = join(await mkdtemp(join(tmpdir(), 'dsbuilder-generator-')), 'package');
});

afterEach(async () => {
    await rm(join(pathToDir, '..'), { recursive: true, force: true });
});

/** Минимальная заготовка пакета `base` во временном каталоге теста. */
const base = () => ({ pathToDir, packageName: 'base', packageVersion: '0.1.0', coreVersion: 'latest', hasComponents: true });

describe('generator', () => {
    it('копирует заготовку пакета из constants рядом с модулем генератора', async () => {
        await generateBaseFileStructure({
            pathToDir,
            packageName: 'base',
            packageVersion: '0.1.0',
            coreVersion: 'latest',
            hasComponents: true,
        });

        const files = await readdir(pathToDir);
        for (const file of ['rollup.config.mjs', 'babel.config.js', 'tsconfig.json', '.gitignore', '.npmignore', '.npmrc', 'scripts', 'package.json', 'src']) {
            assert.ok(files.includes(file), `${file} is missing`);
        }
        // Служебные файлы хранятся в заготовке без точки и получают её только в пакете.
        for (const stored of ['gitignore', 'npmignore', 'npmrc']) {
            assert.ok(!files.includes(stored), `${stored} must be renamed`);
        }
        const packageJson = JSON.parse(await readFile(join(pathToDir, 'package.json'), 'utf8'));
        assert.equal(packageJson.name, `${resolveNpmPackageScope()}/base`);
    });

    it('без NPM_PACKAGE_SCOPE называет пакет в scope @sddsjs, с переменной — в её scope', async () => {
        const previous = process.env.NPM_PACKAGE_SCOPE;
        try {
            delete process.env.NPM_PACKAGE_SCOPE;
            await generateBaseFileStructure(base());
            assert.equal(JSON.parse(await readFile(join(pathToDir, 'package.json'), 'utf8')).name, '@sddsjs/base');

            process.env.NPM_PACKAGE_SCOPE = '@acme';
            await generateBaseFileStructure(base());
            assert.equal(JSON.parse(await readFile(join(pathToDir, 'package.json'), 'utf8')).name, '@acme/base');
        } finally {
            if (previous === undefined) delete process.env.NPM_PACKAGE_SCOPE;
            else process.env.NPM_PACKAGE_SCOPE = previous;
        }
    });

    it('неверный NPM_PACKAGE_SCOPE останавливает генерацию до очистки каталога', async () => {
        const previous = process.env.NPM_PACKAGE_SCOPE;
        await generateBaseFileStructure(base());
        try {
            process.env.NPM_PACKAGE_SCOPE = 'acme';
            await assert.rejects(
                generateBaseFileStructure(base()),
                /NPM_PACKAGE_SCOPE.*"acme"/,
            );
            assert.ok((await readdir(pathToDir)).includes('package.json'));
        } finally {
            if (previous === undefined) delete process.env.NPM_PACKAGE_SCOPE;
            else process.env.NPM_PACKAGE_SCOPE = previous;
        }
    });

    it('читает манифест и копирует шаблоны компонента из templates', async () => {
        await generateBaseFileStructure({
            pathToDir,
            packageName: 'base',
            packageVersion: '0.1.0',
            coreVersion: 'latest',
            hasComponents: true,
        });
        await generateComponentsFiles({ pathToDir, componentsMeta: [emptyComponent('Skeleton'), emptyComponent('Body')] });

        const components = join(pathToDir, 'src', 'components');
        // Имя базового конфига ядра — из манифеста `templates/Skeleton/component.json`.
        assert.match(await readFile(join(components, 'Skeleton', 'Skeleton.ts'), 'utf8'), /lineSkeletonConfig/);
        // Дополнительный файл шаблона `templates/Body/BodySizes.tsx` скопирован и реэкспортирован.
        assert.ok((await readdir(join(components, 'Body'))).includes('BodySizes.tsx'));
        assert.match(await readFile(join(components, 'Body', 'index.ts'), 'utf8'), /export \* from '\.\/BodySizes'/);
    });
});

describe('resolveNpmPackageScope', () => {
    it('без переменной или с пустой строкой возвращает @sddsjs', () => {
        assert.equal(DEFAULT_NPM_PACKAGE_SCOPE, '@sddsjs');
        assert.equal(resolveNpmPackageScope({}), '@sddsjs');
        assert.equal(resolveNpmPackageScope({ NPM_PACKAGE_SCOPE: '  ' }), '@sddsjs');
    });

    it('возвращает заданный scope', () => {
        assert.equal(resolveNpmPackageScope({ NPM_PACKAGE_SCOPE: '@acme' }), '@acme');
        assert.equal(resolveNpmPackageScope({ NPM_PACKAGE_SCOPE: '@my-org.design' }), '@my-org.design');
    });

    it('отклоняет значения не по правилам npm', () => {
        for (const value of ['acme', '@', '@Acme', '@.acme', '@ac me', '@acme/base']) {
            assert.throws(() => resolveNpmPackageScope({ NPM_PACKAGE_SCOPE: value }), /NPM_PACKAGE_SCOPE/, value);
        }
    });
});
