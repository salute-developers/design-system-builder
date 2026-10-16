import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import type { Meta } from './generator/componentBuilder/type.ts';

// `utils` генератора требует scope пакета при импорте; скрипты берут его из js/.env, тест задаёт сам.
process.env.NPM_PACKAGE_SCOPE ??= '@test-scope';
const { generateBaseFileStructure, generateComponentsFiles } = await import('./generator/generate.ts');

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
        for (const file of ['rollup.config.mjs', 'babel.config.js', 'eslint.config.mjs', 'scripts', 'package.json', 'src']) {
            assert.ok(files.includes(file), `${file} is missing`);
        }
        const packageJson = JSON.parse(await readFile(join(pathToDir, 'package.json'), 'utf8'));
        assert.equal(packageJson.name, `${process.env.NPM_PACKAGE_SCOPE}/base`);
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
