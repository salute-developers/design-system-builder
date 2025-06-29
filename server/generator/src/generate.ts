import fs from 'fs-extra';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import { generate } from '@salutejs/core-themes';

import {
    createComponent,
    createComponentConfig,
    createComponentIndex,
    createPackageJSON,
    createRootIndex,
} from './creators';

import { Config } from '../../../client/src/componentBuilder';
import { BaseFileStructure, ComponentsFiles, ThemeFiles } from './types';

export const generateBaseFileStructure = async ({
    pathToDir,
    packageName,
    packageVersion,
    coreVersion,
}: BaseFileStructure) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    await fs.mkdir(pathToDir, { recursive: true });

    const constantsDir = path.join(__dirname, 'constants');
    await fs.copy(constantsDir, pathToDir);

    const packageJSON = createPackageJSON({
        packageName,
        packageVersion,
        coreVersion,
    });
    await fs.writeFile(`${pathToDir}/package.json`, packageJSON);

    await fs.mkdir(`${pathToDir}/src`);
};

export const generateComponentsFiles = async ({ pathToDir, componentsMeta }: ComponentsFiles) => {
    const configs = componentsMeta.map((meta) => new Config(meta));

    const rootIndex = createRootIndex(configs);
    await fs.writeFile(`${pathToDir}/src/index.ts`, rootIndex);

    for await (const config of configs) {
        const componentName = config.getName();
        const componentDescription = config.getDescription();

        const pathToComponent = `${pathToDir}/src/components/${componentName}`;

        await fs.mkdir(pathToComponent, { recursive: true });

        const componentIndex = createComponentIndex(componentName);
        await fs.writeFile(`${pathToComponent}/index.ts`, componentIndex);

        const component = createComponent(componentName, componentDescription);
        await fs.writeFile(`${pathToComponent}/${componentName}.ts`, component);

        const componentConfig = createComponentConfig(componentName, config);
        await fs.writeFile(`${pathToComponent}/${componentName}.config.ts`, componentConfig);
    }
};

export const generateThemeFiles = async ({ packageName, packageVersion, pathToDir, themeSource }: ThemeFiles) => {
    const path = `${pathToDir}/src/theme`;

    await fs.mkdir(path, { recursive: true });

    const themeMeta = {
        name: packageName,
        version: packageVersion,
    };

    try {
        await generate([themeMeta], themeSource, path);
    } catch (e) {
        console.log(e);
    }
};
