import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import type { Meta } from '../services/generator/app/componentBuilder/type.ts';
import { generateTheme } from './generate-theme.ts';
import { readThemeSource } from './theme-source.ts';
import { resolveLocalThemePaths } from './local-theme-source.ts';

const cliDirectory = dirname(fileURLToPath(import.meta.url));
// Генератор использует CommonJS: подключаем его из ES-модуля через require с обработчиком TypeScript от tsx.
const require = createRequire(import.meta.url);
const { generateBaseFileStructure, generateComponentsFiles } =
    require('../services/generator/app/generate.ts') as typeof import('../services/generator/app/generate.ts');
const { CORE_VERSION } =
    require('../services/generator/app/utils/index.ts') as typeof import('../services/generator/app/utils/index.ts');

/**
 * Разбирает аргументы CLI, читает компоненты и тему из .sdds и создаёт исходники React-пакета.
 * Использует существующий генератор без обращений к бэкенду и без запуска сборки пакета.
 */
async function main() {
    const { values } = parseArgs({
        options: {
            sdds: { type: 'string', default: join(cliDirectory, '.sdds') },
            tenant: { type: 'string' },
            'ds-name': { type: 'string' },
            'ds-version': { type: 'string', default: '0.1.0' },
            'core-version': { type: 'string', default: CORE_VERSION },
            help: { type: 'boolean', short: 'h' },
        },
    });

    if (values.help) {
        console.log(`Generate a local React component package using services/generator.

Usage: npm run generate:components -- [options]
  --sdds <directory>       Local data directory (default: js/cli/.sdds)
  --tenant <name>          Theme tenant (default: sole tenant in .sdds/config.json)
  --ds-name <name>         Package name (default: tenant name)
  --ds-version <version>   Package version (default: 0.1.0)
  --core-version <version> Plasma core version (default: ${CORE_VERSION})

Reads component-configs.json and tenants/<tenant> from .sdds.
Writes package sources to js/cli/output/components (replaced on each run).`);
        return;
    }

    const sddsDirectory = resolve(values.sdds);
    const componentsPath = join(sddsDirectory, 'component-configs.json');
    const data: unknown = JSON.parse(await readFile(componentsPath, 'utf8'));
    // Проверяем основные поля формата генератора и допустимость имён компонентов,
    // которые затем используются в именах файлов и экспортах.
    if (!Array.isArray(data) || data.length === 0 || data.some((component) =>
        !component || typeof component.name !== 'string' ||
        !/^[A-Za-z_$][\w$]*$/.test(component.name) ||
        !Array.isArray(component.sources?.api) ||
        !Array.isArray(component.sources?.variations) ||
        !Array.isArray(component.sources?.configs)
    )) {
        throw new Error(`${componentsPath} must contain a non-empty array of generator component metadata (name, sources.api, sources.variations, sources.configs).`);
    }

    const source = await readThemeSource(await resolveLocalThemePaths(sddsDirectory, values.tenant));
    const pathToDir = join(cliDirectory, 'output', 'components');

    // Все входные файлы читаем до этого шага: генератор удаляет предыдущий каталог результата.
    await generateBaseFileStructure({
        pathToDir,
        packageName: values['ds-name'] ?? source.meta.name,
        packageVersion: values['ds-version'],
        coreVersion: values['core-version'],
    });
    await generateTheme(source, join(pathToDir, 'src', 'theme'));
    await generateComponentsFiles({ pathToDir, componentsMeta: data as Meta[] });
    console.log(`Generated ${pathToDir}`);
}

main().catch((error) => {
    console.error('Failed to generate components:', error);
    process.exitCode = 1;
});
