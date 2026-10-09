import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { COMPONENTS_PACKAGE, readComponentsForGeneration } from './components-input.ts';
import { generateTheme } from './generate-theme.ts';
import { CORE_VERSION, cliDirectory, writePackagePart } from './package-output.ts';
import { readThemeSource } from './theme-source.ts';
import { resolveLocalThemePaths } from './local-theme-source.ts';

// Генератор использует CommonJS: подключаем его из ES-модуля через require с обработчиком TypeScript от tsx.
const require = createRequire(import.meta.url);
const { generateComponentsFiles } =
    require('../../services/generator/app/generate.ts') as typeof import('../../services/generator/app/generate.ts');

/**
 * Генерирует дизайн-систему целиком: тему и компоненты из .sdds одним запуском.
 * Без `--package` в `output` заменяются `src/theme` и `src/components`; с `--package` собирается один
 * полный пакет, как в сервисе генерации. К бэкенду CLI не обращается.
 */
async function main() {
    const { values } = parseArgs({
        options: {
            sdds: { type: 'string', default: join(cliDirectory, '.sdds') },
            components: { type: 'string' },
            web: { type: 'string' },
            tenant: { type: 'string' },
            out: { type: 'string', default: join(cliDirectory, 'output') },
            name: { type: 'string' },
            'ds-version': { type: 'string', default: '0.1.0' },
            'core-version': { type: 'string', default: CORE_VERSION },
            package: { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h' },
        },
    });

    if (values.help) {
        console.log(`Generate a local React design system package (theme and components) using services/generator.

Usage: npm run generate:ds -- [options]
  --sdds <directory>       Local data directory (default: js/cli/.sdds)
  --components <directory> Fetched components (default: <sdds>/components)
  --web <directory>        Web data: web-adapter.json (default: <sdds>/web)
  --tenant <name>          Theme tenant (default: sole tenant in .sdds/config.json)
  --out <directory>        Output directory (default: js/cli/output)
  --name <name>            Package name; required with --package
  --ds-version <version>   Package version (default: 0.1.0)
  --core-version <version> Plasma core version (default: ${CORE_VERSION})
  --package                Build the full package and write a .tgz instead of the sources

Combines generate:theme and generate:components: the theme from tenants/<tenant>, the components from
the components directory and web-adapter.json, web token mappings from ${COMPONENTS_PACKAGE}.
Replaces src/theme, src/components and src/index.ts in the output directory, or writes
<scope>-<name>-<version>.tgz with --package.`);
        return;
    }

    const sddsDirectory = resolve(values.sdds);
    const componentsMeta = await readComponentsForGeneration({
        sddsDirectory,
        components: values.components,
        web: values.web,
    });
    const source = await readThemeSource(await resolveLocalThemePaths(sddsDirectory, values.tenant));

    const result = await writePackagePart({
        parts: ['theme', 'components'],
        outputDirectory: resolve(values.out),
        packageName: values.name,
        packageVersion: values['ds-version'],
        coreVersion: values['core-version'],
        pack: values.package,
        fill: async (pathToDir) => {
            await generateTheme(source, join(pathToDir, 'src', 'theme'));
            await generateComponentsFiles({ pathToDir, componentsMeta });
        },
    });
    console.log(`Generated ${result}`);
}

main().catch((error) => {
    console.error('Failed to generate the design system:', error);
    process.exitCode = 1;
});
