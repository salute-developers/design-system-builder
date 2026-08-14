import { lowerFirstLetter, upperFirstLetter } from '../utils';

// TODO: временный хардкод. В новых версиях @salutejs/plasma-new-hope имя экспортируемого
// базового конфига некоторых компонентов не совпадает с `${lowerFirstLetter(name)}Config`.
// Например, у Skeleton базовый конфиг называется `lineSkeletonConfig`, а не `skeletonConfig`.
const PLASMA_CONFIG_NAME_OVERRIDES: Record<string, string> = {
    Skeleton: 'lineSkeletonConfig',
};

const getPlasmaConfigName = (componentName: string) =>
    PLASMA_CONFIG_NAME_OVERRIDES[componentName] ?? `${lowerFirstLetter(componentName)}Config`;

const getComponentConfigImport = (componentName: string, componentConfig: string) =>
    `import { config as ${componentConfig}Config } from './${componentName}.${componentConfig}.config'`;

// TODO: баг — вариантный компонент собирается из mergedConfigDefault вместо своего
// mergedConfig${upperFirstLetter(componentConfig)}, поэтому все варианты будут выглядеть как default.
// Сейчас не стреляет: у компонентов в БД всегда один конфиг и работает createSingleComponent.
// Поправить на component(mergedConfig${upperFirstLetter(componentConfig)}) при добавлении поддержки множественных конфигов.
const getComponentInstance = (componentName: string, componentConfig: string) => {
    return `export const mergedConfig${upperFirstLetter(componentConfig)} = mergeConfig(${getPlasmaConfigName(
        componentName,
    )}, ${componentConfig}Config);
export const ${componentName}${upperFirstLetter(componentConfig)} = component(mergedConfigDefault);`;
};

const getComponentCondition = (componentName: string, componentConfig: string) => {
    return `{
        conditions: { prop: 'appearance', value: '${componentConfig}' },
        component: ${componentName}${upperFirstLetter(componentConfig)},
    },`;
};

export const createMultipleComponent = (
    componentName: string,
    componentDescription: string,
    componentConfigs: string[],
) => `import { ComponentProps } from 'react';
import { ${getPlasmaConfigName(
    componentName,
)}, component, mergeConfig, createConditionalComponent } from '@salutejs/plasma-new-hope/styled-components';

import { config as defaultConfig } from './${componentName}.config';
${componentConfigs.map((config) => getComponentConfigImport(componentName, config)).join('\n')}

export const mergedConfigDefault = mergeConfig(${getPlasmaConfigName(componentName)}, defaultConfig);
export const ${componentName}Default = component(mergedConfigDefault);
${componentConfigs.map((config) => getComponentInstance(componentName, config)).join('\n')}

export type ${componentName}Props = ComponentProps<typeof ${componentName}Default>;

/**
 * ${componentDescription}
 */
export const ${componentName} = createConditionalComponent<${componentName}Props>(${componentName}Default, [
    ${componentConfigs.map((config) => getComponentCondition(componentName, config)).join('\n    ')}
]);
`;

export const createSingleComponent = (
    componentName: string,
    componentDescription: string,
) => `import { ${getPlasmaConfigName(
    componentName,
)}, component, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

import { config } from './${componentName}.config';

const mergedConfig = mergeConfig(${getPlasmaConfigName(componentName)}, config);
const ${componentName}Component = component(mergedConfig);

/**
 * ${componentDescription}
 */
export const ${componentName} = ${componentName}Component;
`;

export const createComponent = (componentName: string, componentDescription: string, componentConfigs: string[]) => {
    if (componentConfigs.length === 1) {
        return createSingleComponent(componentName, componentDescription);
    }

    const filteredComponentConfig = componentConfigs.filter((config) => config !== 'default');
    return createMultipleComponent(componentName, componentDescription, filteredComponentConfig);
};
