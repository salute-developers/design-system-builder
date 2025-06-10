import { Config } from '../../../../client/src/componentBuilder';

export const createRootIndex = (configs: Config[]) => {
    const components = configs.map((config) => `export * from './components/${config.getName()}';`).join('\n');

    return `${components}
    
export * from './theme'
`;
};
