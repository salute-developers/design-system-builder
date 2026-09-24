import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { generateTheme } from './generate-theme.ts';
import { readThemeSource, writeThemeSourceModules } from './theme-source.ts';
import { resolveLocalThemePaths } from './local-theme-source.ts';

const cliDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(cliDirectory, 'output');
const themeOutputDirectory = join(outputDirectory, 'theme');

/** Генерирует отдельную тему из .sdds; tenant выбирается явно или из локальной конфигурации. */
async function main() {
    const { values } = parseArgs({
        options: {
            sdds: { type: 'string', default: join(cliDirectory, '.sdds') },
            tenant: { type: 'string' },
            help: { type: 'boolean', short: 'h' },
        },
    });
    if (values.help) {
        console.log(`Generate a local theme using services/generator.

Usage: npm run generate:theme -- [options]
  --sdds <directory>       Local data directory (default: js/cli/.sdds)
  --tenant <name>          Theme tenant (default: sole tenant in .sdds/config.json)

Writes theme files to js/cli/output/theme and source modules to js/cli/output.
The theme directory is replaced on each run.`);
        return;
    }
    const source = await readThemeSource(await resolveLocalThemePaths(resolve(values.sdds), values.tenant));
    await mkdir(outputDirectory, { recursive: true });
    const generatedSourcePaths = await writeThemeSourceModules(source, outputDirectory);

    await generateTheme(source, themeOutputDirectory);

    for (const path of [...generatedSourcePaths, themeOutputDirectory]) {
        console.log(`Generated ${path}`);
    }
}

main().catch((error) => {
    console.error('Failed to generate theme:', error);
    process.exitCode = 1;
});
