import type { ComponentManifest } from '../types';
import { getPlasmaConfigName, lowerFirstLetter, upperFirstLetter } from '../utils';

/**
 * Приведение типа результата `component(...)`, как у Modal, Popup, Tooltip в sdds-serv:
 * ядро отдаёт слишком общий тип, и потребителю нужны пропсы конкретного компонента.
 * Тип берётся из `@salutejs/plasma-new-hope/styled-components`, а не из локального index.ts,
 * чтобы не плодить циклический импорт.
 */
/** `export type XProps = ComponentProps<typeof XComponent>`, если так делает обёртка sdds-serv. */
const localPropsType = (componentName: string, wrapper?: ComponentManifest | null) =>
    (wrapper?.reexports?.localTypes ?? []).includes(`${componentName}Props`)
        ? `\nexport type ${componentName}Props = ComponentProps<typeof ${componentName}Component>;\n`
        : '';

const castParts = (wrapper?: ComponentManifest | null) => {
    const props = wrapper?.castToProps;
    if (!props) {
        return { reactImport: '', coreImport: '', cast: '' };
    }

    return {
        reactImport: `import type { ForwardRefExoticComponent, RefAttributes } from 'react';\n`,
        coreImport: `${props}, `,
        cast: ` as ForwardRefExoticComponent<${props} & RefAttributes<HTMLDivElement>>`,
    };
};

const configAlias = (name: string) => `${lowerFirstLetter(name)}Config`;
const configFile = (componentName: string, name: string) => (name === 'default' ? `${componentName}.config` : `${componentName}.${name}.config`);

/**
 * Обёртка над несколькими appearance с одним базовым конфигом ядра (Range: default и clear):
 * `createConditionalComponent` ядра выбирает реализацию по пропу `appearance`, как в sdds-serv.
 */
export const createConditionalComponent = (
    componentName: string,
    componentDescription: string,
    appearanceNames: string[],
    configName: string,
) => {
    const parts = appearanceNames.map((name) => ({
        name,
        Local: `${componentName}${upperFirstLetter(name)}`,
        alias: configAlias(name),
        file: configFile(componentName, name),
    }));

    return `import { ${configName}, component, mergeConfig, createConditionalComponent } from '@salutejs/plasma-new-hope/styled-components';

${parts.map((part) => `import { config as ${part.alias} } from './${part.file}';`).join('\n')}

${parts
    .map(
        (part) => `const merged${upperFirstLetter(part.name)}Config = mergeConfig(${configName}, ${part.alias});
export const ${part.Local} = component(merged${upperFirstLetter(part.name)}Config);`,
    )
    .join('\n\n')}

/**
 * ${componentDescription}
 */
export const ${componentName} = createConditionalComponent({
${parts.map((part) => `    ${part.name}: ${part.Local},`).join('\n')}
});
`;
};

export const createSingleComponent = (
    componentName: string,
    componentDescription: string,
    configName: string,
    wrapper?: ComponentManifest | null,
) => {
    const { reactImport, coreImport, cast } = castParts(wrapper);
    const propsType = localPropsType(componentName, wrapper);
    const propsImport = propsType ? `import type { ComponentProps } from 'react';\n` : '';

    return `${propsImport}${reactImport}import { ${coreImport}${configName}, component, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

import { config } from './${componentName}.config';

const mergedConfig = mergeConfig(${configName}, config);
const ${componentName}Component = component(mergedConfig)${cast};
${propsType}
/**
 * ${componentDescription}
 */
export const ${componentName} = ${componentName}Component;
`;
};

export const createEmptyComponent = (
    componentName: string,
    componentDescription: string,
    coreConfigExport?: string | null,
    wrapper?: ComponentManifest | null,
) => {
    const configName = getPlasmaConfigName(componentName, coreConfigExport);
    const { reactImport, coreImport, cast } = castParts(wrapper);

    return `${reactImport}import { ${coreImport}${configName}, component, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

const mergedConfig = mergeConfig(${configName});
const ${componentName}Component = component(mergedConfig)${cast};

/**
 * ${componentDescription}
 */
export const ${componentName} = ${componentName}Component;
`;
};

/**
 * Дженерик-обёртка, как Select, Combobox, Dropdown в sdds-serv: `fixedForwardRef` сохраняет
 * параметр типа элемента списка, вариации конфига темы берутся из типа сгенерированного компонента,
 * остальные пропсы — из типа ядра. Список вариаций выводится из конфига (`keyof typeof config['variations']`),
 * как в каноничной форме Autocomplete, а не перечисляется руками.
 */
export const createGenericComponent = (
    componentName: string,
    componentDescription: string,
    coreConfigExport: string | null | undefined,
    generic: NonNullable<ComponentManifest['generic']>,
) => {
    const configName = getPlasmaConfigName(componentName, coreConfigExport);
    const { propsType, itemType, refElement } = generic;
    const propsAlias = propsType === `${componentName}Props` ? `${propsType} as ${propsType}NewHope` : propsType;
    const coreProps = propsType === `${componentName}Props` ? `${propsType}NewHope` : propsType;

    return `import React, { ComponentProps, ForwardedRef } from 'react';
import { ${configName}, component, mergeConfig, fixedForwardRef } from '@salutejs/plasma-new-hope/styled-components';
import type { ${propsAlias}, ${itemType}, DistributiveOmit, DistributivePick } from '@salutejs/plasma-new-hope';

import { config } from './${componentName}.config';

const mergedConfig = mergeConfig(${configName}, config);
const ${componentName}Component = component(mergedConfig);

type PropsFromConfig = keyof typeof config['variations'];

export type ${componentName}Props<T extends ${itemType}> = DistributiveOmit<${coreProps}<T>, PropsFromConfig> &
    DistributivePick<ComponentProps<typeof ${componentName}Component>, PropsFromConfig>;

const ${componentName}WithoutRef = <T extends ${itemType}>(props: ${componentName}Props<T>, ref: ForwardedRef<${refElement}>) => {
    return <${componentName}Component ref={ref} {...(props as any)} />;
};

/**
 * ${componentDescription}
 */
export const ${componentName} = fixedForwardRef(${componentName}WithoutRef);
`;
};

export const createComponent = (
    componentName: string,
    componentDescription: string,
    coreConfigExport?: string | null,
    wrapper?: ComponentManifest | null,
) => createSingleComponent(componentName, componentDescription, getPlasmaConfigName(componentName, coreConfigExport), wrapper);
