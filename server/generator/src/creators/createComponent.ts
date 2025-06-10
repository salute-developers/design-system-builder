import { lowerFirstLetter } from '../utils';

export const createComponent = (
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
