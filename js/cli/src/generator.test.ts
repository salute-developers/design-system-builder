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

    it('Grid: вид по точкам перелома из значений стиля и число колонок типа integer', async () => {
        const api = (name: string, type: string) => ({
            id: name,
            name,
            type,
            variations: null,
            platformMappings: { xml: null, compose: null, ios: null, web: [{ name, adjustment: null }] },
        });
        const grid = {
            name: 'Grid',
            description: '',
            sources: {
                api: [api('smallMMinWidth', 'dimension'), api('largeMMinWidth', 'dimension'), api('smallMColsCount', 'integer')],
                variations: [{ id: 'view', name: 'view' }],
                configs: [
                    {
                        id: 'default',
                        name: 'default',
                        config: {
                            defaultVariations: [{ variationID: 'view', styleID: 'view:default' }],
                            invariantProps: [],
                            variations: [
                                {
                                    id: 'view',
                                    styles: [
                                        {
                                            name: 'default',
                                            id: 'view:default',
                                            intersections: null,
                                            props: [
                                                { id: 'smallMMinWidth', value: '1', states: [] },
                                                { id: 'largeMMinWidth', value: '1200', states: [] },
                                                { id: 'smallMColsCount', value: '6', states: [] },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                ],
            },
        } as unknown as Meta;
        await generateBaseFileStructure(base());
        await generateComponentsFiles({ pathToDir, componentsMeta: [grid] });

        const config = await readFile(join(pathToDir, 'src', 'components', 'Grid', 'Grid.config.ts'), 'utf8');
        assert.match(config, /import \{ css, getBaseGridView, gridTokens \}/);
        assert.match(
            config,
            /\$\{getBaseGridView\(\{ \[gridTokens\.largeMMinWidth\]: '75rem', \[gridTokens\.smallMMinWidth\]: '0\.0625rem' \}, 'default'\)\};/,
        );
        assert.match(config, /\$\{gridTokens\.smallMColsCount\}: 6;/);
    });

    it('компонент, которому нужна тема, пишет только в пакет с темой', async () => {
        await generateBaseFileStructure(base());
        await generateComponentsFiles({ pathToDir, componentsMeta: [emptyComponent('ViewContainer'), emptyComponent('Image')], hasTheme: false });

        const components = join(pathToDir, 'src', 'components');
        assert.deepEqual(await readdir(components), ['Image']);

        await generateComponentsFiles({ pathToDir, componentsMeta: [emptyComponent('ViewContainer')] });
        // Обёртку даёт шаблон: вид onDark/onLight — из `viewContainer` темы пакета.
        assert.match(await readFile(join(components, 'ViewContainer', 'ViewContainer.ts'), 'utf8'), /from '\.\.\/\.\.\/theme'/);
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
