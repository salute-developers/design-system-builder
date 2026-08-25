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

const OUTPUT_LOG_LIMIT = 12_000;

const getOutputTail = (value: unknown) => {
    if (typeof value !== 'string') {
        return undefined;
    }

    return value.length > OUTPUT_LOG_LIMIT ? value.slice(-OUTPUT_LOG_LIMIT) : value;
};

const getErrorDetails = (error: unknown) => {
    const processError = error as {
        cmd?: unknown;
        args?: unknown;
        code?: unknown;
        signal?: unknown;
        stdout?: unknown;
        stderr?: unknown;
    };

    return {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        command: typeof processError?.cmd === 'string' ? processError.cmd : undefined,
        args: Array.isArray(processError?.args) ? processError.args : undefined,
        code: processError?.code,
        signal: processError?.signal,
        stdoutTail: getOutputTail(processError?.stdout),
        stderrTail: getOutputTail(processError?.stderr),
    };
};

const runGenerationPhase = async <T>(
    requestId: string,
    phase: string,
    pathToDir: string,
    action: () => Promise<T>,
) => {
    const startedAt = Date.now();
    console.log('[generator:phase:start]', { requestId, phase, pathToDir });

    try {
        const result = await action();
        console.log('[generator:phase:success]', {
            requestId,
            phase,
            pathToDir,
            durationMs: Date.now() - startedAt,
        });
        return result;
    } catch (error) {
        console.error('[generator:phase:error]', {
            requestId,
            phase,
            pathToDir,
            durationMs: Date.now() - startedAt,
            ...getErrorDetails(error),
        });
        throw error;
    }
};

export const generateBaseFileStructure = async ({
    pathToDir,
    packageName,
    packageVersion,
    coreVersion,
}: BaseFileStructure) => {
    // const __filename = fileURLToPath(import.meta.url);
    // const __dirname = dirname(__filename);

    // Полностью очищаем прошлый результат: иначе остаются старые node_modules/package-lock.json
    // и `npm install` при сборке подтягивает устаревшую версию @salutejs/plasma-new-hope.
    await fs.remove(pathToDir);
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

    await generate([themeMeta], themeSource, path);
};

export const generateDesignSystem = async (designSystemData: DesignSystemData, outputParams: OutputParams) => {
    const { packageName, packageVersion, componentsData, themeData } = designSystemData;
    const { pathToDir, coreVersion, exportType, requestId = 'cli' } = outputParams;
    const startedAt = Date.now();

    console.log('[generator:design-system:start]', {
        requestId,
        packageName,
        packageVersion,
        exportType,
        coreVersion,
        pathToDir,
        componentsCount: componentsData.length,
    });

    await runGenerationPhase(requestId, 'base-files', pathToDir, () =>
        generateBaseFileStructure({ pathToDir, packageName, packageVersion, coreVersion }),
    );

    await runGenerationPhase(requestId, 'theme-files', pathToDir, () =>
        generateThemeFiles({ pathToDir, packageName, packageVersion, themeSource: getThemeData(themeData) }),
    );

    await runGenerationPhase(requestId, 'component-files', pathToDir, () =>
        generateComponentsFiles({ pathToDir, componentsMeta: componentsData }),
    );

    let buffer: Buffer<ArrayBufferLike> = Buffer.from('');

    if (exportType === 'zip') {
        buffer = await runGenerationPhase(requestId, 'zip', pathToDir, async () => {
            const zip = new JSZip();
            await addFolderToZip(zip, pathToDir, zip);
            return zip.generateAsync({ type: 'nodebuffer' });
        });
    }

    if (exportType === 'tgz') {
        buffer = await runGenerationPhase(requestId, 'pacote-tarball-and-prepare', pathToDir, () =>
            pacote.tarball(pathToDir),
        );
    }

    console.log('[generator:design-system:success]', {
        requestId,
        packageName,
        packageVersion,
        exportType,
        pathToDir,
        bufferBytes: buffer.length,
        durationMs: Date.now() - startedAt,
    });

    return buffer;
};
