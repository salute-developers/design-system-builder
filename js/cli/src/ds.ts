import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { COMPONENTS_PACKAGE, readComponentsForGeneration } from './components-input.ts';
import { generateThemes } from './generate-theme.ts';
import { generateComponentsFiles } from './generator/generate.ts';
import { CORE_VERSION, cliDirectory, writePackagePart } from './package-output.ts';
import { readThemeSetSource } from './theme-source.ts';
import { resolveLocalThemes } from './local-theme-source.ts';

/**
 * Генерирует дизайн-систему целиком: тему и компоненты из .sdds одним запуском.
 * Без `--package` в `output` заменяются `src/theme` и `src/components`; с `--package` собирается один
 * полный пакет. К бэкенду CLI не обращается.
 */
async function main() {
    const { values } = parseArgs({
        options: {
            sdds: { type: 'string', default: join(cliDirectory, '.sdds') },
            components: { type: 'string' },
            web: { type: 'string' },
            tenant: { type: 'string' },
            'default-tenant': { type: 'string' },
            out: { type: 'string', default: join(cliDirectory, 'output') },
            name: { type: 'string' },
            'ds-version': { type: 'string', default: '0.1.0' },
            'core-version': { type: 'string', default: CORE_VERSION },
            package: { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h' },
        },
    });

    if (values.help) {
        console.log(`Generate a local React design system package (theme and components).

Usage: npm run generate:ds -- [options]
  --sdds <directory>       Local data directory (default: js/cli/.sdds)
  --components <directory> Fetched components (default: <sdds>/components)
  --web <directory>        Web data: web-adapter.json (default: <sdds>/web)
  --tenant <name>          Generate one theme: a tenant name from .sdds/config.json, otherwise
                           a directory name in .sdds/tenants (default: every theme)
  --default-tenant <name>  Theme whose values become the fallbacks in tokens (default: the first
                           generated theme by directory name); looked up like --tenant
  --out <directory>        Output directory (default: js/cli/output)
  --name <name>            Package name; required with --package
  --ds-version <version>   Package version (default: 0.1.0)
  --core-version <version> Plasma core version (default: ${CORE_VERSION})
  --package                Build the full package and write a .tgz instead of the sources

Combines generate:theme and generate:components: every theme from .sdds/tenants, the components from
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
    const source = await readThemeSetSource(
        await resolveLocalThemes(sddsDirectory, {
            tenant: values.tenant,
            defaultTenant: values['default-tenant'],
        }),
    );

    const result = await writePackagePart({
        parts: ['theme', 'components'],
        outputDirectory: resolve(values.out),
        packageName: values.name,
        packageVersion: values['ds-version'],
        coreVersion: values['core-version'],
        pack: values.package,
        fill: async (pathToDir) => {
            await generateThemes(source, join(pathToDir, 'src', 'theme'));
            await generateComponentsFiles({ pathToDir, componentsMeta });
        },
    });
    console.log(`Generated ${result}`);
}

main().catch((error) => {
    console.error('Failed to generate the design system:', error);
    process.exitCode = 1;
});
