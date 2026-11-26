import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { Meta } from './generator/componentBuilder/type.ts';
import { readComponentsMeta } from './component-source.ts';
import { buildApiMeta } from './generate-api-meta.ts';
import { cliDirectory } from './package-output.ts';
import { webAdapter, type WebAdapter } from './web-mapping/index.ts';

/** Пакет компонентов, из аннотаций токенов которого берутся web-параметры свойств. */
export const COMPONENTS_PACKAGE = '@salutejs/plasma-new-hope';

/**
 * Читает компоненты для генерации: выгрузку из `.sdds`, web-маппинги установленного пакета и
 * `web-adapter.json` — встроенный в CLI или из каталога `web`, если он передан явно.
 *
 * Маппинги собираются на каждый запуск из установленного пакета: так они всегда соответствуют
 * версии, с которой собирается пакет. Пакет ищется от каталога CLI, а не от текущего каталога.
 */
export async function readComponentsForGeneration(options: {
    sddsDirectory: string;
    components?: string;
    web?: string;
}): Promise<Meta[]> {
    const { metadata: apiMeta, source } = await buildApiMeta({ packageName: COMPONENTS_PACKAGE }, cliDirectory);
    console.log(`Web token mappings: ${source.name}@${source.version}`);
    const componentsMeta = await readComponentsMeta({
        apiMeta,
        componentsDirectory: resolve(options.components ?? join(options.sddsDirectory, 'components')),
        webAdapter: options.web
            ? (JSON.parse(await readFile(join(resolve(options.web), 'web-adapter.json'), 'utf8')) as WebAdapter)
            : webAdapter,
    });
    if (componentsMeta.length === 0) {
        throw new Error('The components directory has no configurations: run `dsbuilder components fetch` first.');
    }
    return componentsMeta;
}
