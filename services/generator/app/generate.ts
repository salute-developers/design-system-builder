import fs from 'fs-extra';
import path from 'path';
import pacote from 'pacote';
// import { fileURLToPath } from 'url';

import { generate } from './themeBuilder';

import {
    createComponent,
    createComponentConfig,
    createComponentIndex,
    createPackageJSON,
    createRootIndex,
} from './creators';

import { BaseFileStructure, ComponentsFiles, DesignSystemData, OutputParams, ThemeFiles } from './types';
import { Config } from './componentBuilder';
import JSZip from 'jszip';
import { addFolderToZip, getThemeData } from './utils';

export const generateBaseFileStructure = async ({
    pathToDir,
    packageName,
    packageVersion,
    coreVersion,
}: BaseFileStructure) => {
    // const __filename = fileURLToPath(import.meta.url);
    // const __dirname = dirname(__filename);

    await fs.mkdir(pathToDir, { recursive: true });

    const constantsDir = path.join(__dirname, 'constants');
    await fs.copy(constantsDir, pathToDir);

    const packageJSON = createPackageJSON({
        packageName,
        packageVersion,
        coreVersion,
    });
    await fs.writeFile(`${pathToDir}/package.json`, packageJSON);

    await fs.mkdir(`${pathToDir}/src`, { recursive: true });
};

export const generateComponentsFiles = async ({ pathToDir, componentsMeta }: ComponentsFiles) => {
    const componentsName = componentsMeta.map((meta) => meta.name);
    const rootIndex = createRootIndex(componentsName);
    await fs.writeFile(`${pathToDir}/src/index.ts`, rootIndex);

    for await (const componentMeta of componentsMeta) {
        const componentName = componentMeta.name;
        const componentDescription = componentMeta.description;
        const configs = componentMeta.sources.configs;
        const componentConfigs = configs.map(({ name }) => name);

        const pathToComponent = `${pathToDir}/src/components/${componentName}`;

        await fs.mkdir(pathToComponent, { recursive: true });

        const componentIndex = createComponentIndex(componentName);
        await fs.writeFile(`${pathToComponent}/index.ts`, componentIndex);

        const component = createComponent(componentName, componentDescription, componentConfigs);
        await fs.writeFile(`${pathToComponent}/${componentName}.ts`, component);

        for await (const item of configs) {
            const { id, name } = item;
            const config = new Config(componentMeta, { id, name });
            const componentConfigFileName = name === 'default' ? componentName : `${componentName}.${name}`;

            const componentConfig = createComponentConfig(componentName, config);
            await fs.writeFile(`${pathToComponent}/${componentConfigFileName}.config.ts`, componentConfig);
        }
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

export const generateDesignSystem = async (designSystemData: DesignSystemData, outputParams: OutputParams) => {
    const { packageName, packageVersion, componentsData, themeData } = designSystemData;
    const { pathToDir, coreVersion, exportType } = outputParams;

    await generateBaseFileStructure({ pathToDir, packageName, packageVersion, coreVersion });

    await generateThemeFiles({ pathToDir, packageName, packageVersion, themeSource: getThemeData(themeData) });

    await generateComponentsFiles({ pathToDir, componentsMeta: componentsData });

    let buffer: Buffer<ArrayBufferLike> = Buffer.from('');

    if (exportType === 'zip') {
        const zip = new JSZip();
        await addFolderToZip(zip, pathToDir, zip);
        buffer = await zip.generateAsync({ type: 'nodebuffer' });
    }

    if (exportType === 'tgz') {
        buffer = await pacote.tarball(pathToDir);
    }

    return buffer;
};
