import type { ComponentManifest } from '../types';

const CORE = '@salutejs/plasma-new-hope/styled-components';

/** Строки реэкспортов ядра из манифеста: значения и типы отдельно, как в index.ts sdds-serv. */
export const createReexportLines = (manifest?: ComponentManifest | null) => {
    const runtime = manifest?.reexports?.runtime ?? [];
    const types = manifest?.reexports?.types ?? [];
    const lines: string[] = [];
    if (runtime.length) {
        lines.push(`export { ${runtime.join(', ')} } from '${CORE}';`);
    }
    if (types.length) {
        lines.push(`export type { ${types.join(', ')} } from '${CORE}';`);
    }
    const coreTypes = manifest?.reexports?.coreTypes ?? [];
    if (coreTypes.length) {
        lines.push(`export type { ${coreTypes.join(', ')} } from '@salutejs/plasma-new-hope';`);
    }

    return lines;
};

/** Дополнительные файлы из `templates/<X>/` (TabsController, BodySizes): экспортируются целиком. */
export const createExtraLines = (extraExports: string[]) => extraExports.map((name) => `export * from './${name}';`);

export const createComponentIndex = (componentName: string, manifest?: ComponentManifest | null, extraExports: string[] = []) => {
    const localTypes = manifest?.reexports?.localTypes ?? [];
    const siblings = manifest?.siblings ?? [];

    const local = manifest?.reexports?.local ?? [];

    return [
        `export { ${[componentName, ...local].join(', ')} } from './${componentName}';`,
        ...(localTypes.length ? [`export type { ${localTypes.join(', ')} } from './${componentName}';`] : []),
        ...siblings.map(({ name }) => `export { ${name} } from './${name}';`),
        ...createExtraLines(extraExports),
        ...createReexportLines(manifest),
    ].join('\n');
};
