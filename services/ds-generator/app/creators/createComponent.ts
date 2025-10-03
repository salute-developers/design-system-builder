import { lowerFirstLetter, upperFirstLetter } from '../utils';

const getComponentConfigImport = (componentName: string, componentConfig: string) =>
    `import { config as ${componentConfig}Config } from './${componentName}.${componentConfig}.config'`;

const getComponentInstance = (componentName: string, componentConfig: string) => {
    return `export const mergedConfig${upperFirstLetter(componentConfig)} = mergeConfig(${lowerFirstLetter(
        componentName,
    )}Config, ${componentConfig}Config);
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
import { ${lowerFirstLetter(
    componentName,
)}Config, component, mergeConfig, createConditionalComponent } from '@salutejs/plasma-new-hope/styled-components';

import { config as defaultConfig } from './${componentName}.config';
${componentConfigs.map((config) => getComponentConfigImport(componentName, config)).join('\n')}

export const mergedConfigDefault = mergeConfig(${lowerFirstLetter(componentName)}Config, defaultConfig);
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
) => `import { ${lowerFirstLetter(
    componentName,
)}Config, component, mergeConfig } from '@salutejs/plasma-new-hope/styled-components';

import { config } from './${componentName}.config';

const mergedConfig = mergeConfig(${lowerFirstLetter(componentName)}Config, config);
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
