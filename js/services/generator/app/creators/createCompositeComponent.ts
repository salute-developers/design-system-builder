import type { ComponentManifest } from '../types';
import { createExtraLines, createReexportLines } from './createComponentIndex';
import { lowerFirstLetter, upperFirstLetter } from '../utils';

/**
 * Компонент с несколькими appearance (Tabs: horizontal и vertical): у каждого свой базовый конфиг
 * ядра (`horizontalTabsConfig`, `verticalTabsConfig`) и свой файл конфига темы в подпапке appearance.
 * Обёртка выбирает пару по пропу из манифеста (`orientation`), как `Tabs` и `TabItem` в sdds-serv.
 */

/** Имя базового конфига ядра для appearance: horizontal + Tabs → horizontalTabsConfig. */
export const getAppearanceConfigName = (appearance: string, componentName: string) =>
    `${lowerFirstLetter(appearance)}${upperFirstLetter(componentName)}Config`;

/** Имя файла конфига темы для appearance: horizontal/HorizontalTabs.config.ts. */
export const getAppearanceConfigFile = (appearance: string, componentName: string) =>
    `${appearance}/${upperFirstLetter(appearance)}${componentName}.config`;

/**
 * Обёртка, выбирающая базовый конфиг ядра и конфиг темы по пропу appearance — как `Tabs` и `TabItem`
 * в sdds-serv. Ref пробрасывается: элементы списков (TabItem) используются контроллером по ref.
 */
export const createAppearanceWrapper = (
    componentName: string,
    componentDescription: string,
    appearances: { prop: string; default: string },
    names: string[],
) => {
    const parts = names.map((name) => ({
        name,
        Local: `${upperFirstLetter(name)}${componentName}`,
        coreConfig: getAppearanceConfigName(name, componentName),
        themeConfig: `${lowerFirstLetter(name)}Config`,
        file: getAppearanceConfigFile(name, componentName),
    }));

    const branches = parts
        .filter((part) => part.name !== appearances.default)
        .map(
            (part) => `    if (props.${appearances.prop} === '${part.name}') {
        return <${part.Local} ref={ref} {...(props as any)} />;
    }`,
        )
        .join('\n');
    const defaultPart = parts.find((part) => part.name === appearances.default) ?? parts[0];

    return `import React, { ComponentProps, forwardRef } from 'react';
import { ${parts.map((part) => part.coreConfig).join(', ')}, component, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

${parts.map((part) => `import { config as ${part.themeConfig} } from './${part.file}';`).join('\n')}

${parts
    .map(
        (part) => `const merged${part.Local}Config = mergeConfig(${part.coreConfig}, ${part.themeConfig});
export const ${part.Local} = component(merged${part.Local}Config);`,
    )
    .join('\n\n')}

export type ${componentName}Props = ${parts.map((part) => `ComponentProps<typeof ${part.Local}>`).join(' | ')};

/**
 * ${componentDescription}
 */
export const ${componentName} = forwardRef<HTMLElement, ${componentName}Props>((props, ref) => {
${branches}
    return <${defaultPart.Local} ref={ref} {...(props as any)} />;
});
`;
};

/** index.ts папки составного компонента: родитель, дочерние, дополнительные шаблоны и реэкспорты ядра. */
export const createCompositeIndex = (
    componentName: string,
    children: string[],
    extraExports: string[],
    manifest?: ComponentManifest | null,
) =>
    [
        `export { ${[componentName, ...(manifest?.reexports?.local ?? [])].join(', ')} } from './${componentName}';`,
        ...children.map((name) => `export { ${name} } from './${name}';`),
        ...createExtraLines(extraExports),
        ...createReexportLines(manifest),
    ].join('\n');
