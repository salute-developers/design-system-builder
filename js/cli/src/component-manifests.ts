import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { ComponentManifest } from './generator/types/index.ts';
import { cliDirectory } from './package-output.ts';

const usage = `Usage: dsbuilder-web-generator manifests --out <file>

Writes the component manifests of the generator (src/generator/templates/<X>/component.json) as one JSON
object { "<X>": <manifest> }: core export names, re-exports, wrapper options.`;

/** Каталог шаблонов генератора: в нём `templates/<X>/component.json`. */
export const TEMPLATES_DIRECTORY = join(cliDirectory, 'src', 'generator', 'templates');

/** Все манифесты генератора по имени компонента, в порядке имён папок. */
export async function readComponentManifests(directory = TEMPLATES_DIRECTORY): Promise<Record<string, ComponentManifest>> {
    const entries = (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    const manifests: Record<string, ComponentManifest> = {};
    for (const name of entries) {
        try {
            manifests[name] = JSON.parse(await readFile(join(directory, name, 'component.json'), 'utf8')) as ComponentManifest;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
    return manifests;
}

export async function main(argv: string[]) {
    const { values } = parseArgs({ args: argv, options: { out: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
    if (values.help) {
        console.log(usage);
        return;
    }
    if (!values.out) {
        throw new Error(`manifests: --out is required.\n\n${usage}`);
    }
    const manifests = await readComponentManifests();
    const out = resolve(values.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, `${JSON.stringify(manifests, null, 4)}\n`);
    console.log(`Wrote ${Object.keys(manifests).length} component manifests to ${out}`);
}
