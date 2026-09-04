import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateTheme } from './theme-builder/index.ts';
import { readThemeSource, writeThemeSourceModules } from './theme-source.ts';

const cliDirectory = dirname(fileURLToPath(import.meta.url));
const tenantDirectory = join(cliDirectory, '.sdds', 'tenants', 'plasma_homeds_default');
const outputDirectory = join(cliDirectory, 'output');
const themeOutputDirectory = join(outputDirectory, 'theme');

async function main() {
    await mkdir(outputDirectory, { recursive: true });
    const source = await readThemeSource({
        meta: join(tenantDirectory, 'meta.json'),
        palette: join(cliDirectory, '.sdds', 'tenants', 'palette.json'),
        variations: join(tenantDirectory, 'web'),
    });
    const generatedSourcePaths = await writeThemeSourceModules(source, outputDirectory);

    await generateTheme(source.meta, source.variations, source.palette, themeOutputDirectory);

    for (const path of [...generatedSourcePaths, themeOutputDirectory]) {
        console.log(`Generated ${path}`);
    }
}

main().catch((error) => {
    console.error('Failed to generate output:', error);
    process.exitCode = 1;
});
