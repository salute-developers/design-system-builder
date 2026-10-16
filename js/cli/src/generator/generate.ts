import fs from 'fs-extra';
import path from 'path';

import {
    createComponent,
    createConditionalComponent,
    createEmptyComponent,
    createGenericComponent,
    createComponentConfig,
    createComponentIndex,
    createCompositeIndex,
    createAppearanceWrapper,
    getAppearanceConfigFile,
    createPackageJSON,
    createRootIndex,
} from './creators/index.ts';

import { BaseFileStructure, ComponentManifest, ComponentsFiles } from './types/index.ts';
import { Config, Meta } from './componentBuilder/index.ts';
import { getPlasmaConfigName, NPM_PACKAGE_SCOPE } from './utils/index.ts';

export const generateBaseFileStructure = async ({
    pathToDir,
    packageName,
    packageVersion,
    coreVersion,
    hasComponents,
    hasTheme = true,
}: BaseFileStructure) => {
    // Полностью очищаем прошлый результат: иначе остаются старые node_modules/package-lock.json
    // и `npm install` при сборке подтягивает устаревшую версию @salutejs/plasma-new-hope.
    await fs.remove(pathToDir);
    await fs.mkdir(pathToDir, { recursive: true });

    const constantsDir = path.join(import.meta.dirname, 'constants');
    await fs.copy(constantsDir, pathToDir);

    const packageJSON = createPackageJSON({
        packageName,
        packageVersion,
        coreVersion,
        hasComponents,
        hasTheme,
        packageScope: NPM_PACKAGE_SCOPE,
    });
    await fs.writeFile(`${pathToDir}/package.json`, packageJSON);

    await fs.mkdir(`${pathToDir}/src`, { recursive: true });
};

/**
 * Файлы одного компонента в папке `pathToComponent`.
 *
 * Компонент с несколькими appearance (Tabs: horizontal и vertical, поле `appearances` манифеста)
 * получает конфиг темы на каждый appearance в подпапке (`horizontal/HorizontalTabs.config.ts`) и
 * обёртку `<Name>.tsx`, выбирающую базовый конфиг ядра по пропу. Остальные — один файл конфига
 * на appearance и `<Name>.ts`.
 */
/** Ни свойств в API, ни значений в конфигах: генерировать нечего, кроме обёртки. */
const isEmptyComponent = (meta: Meta) =>
    (meta.sources.api ?? []).length === 0 &&
    meta.sources.configs.every(
        ({ config }) =>
            (config.invariantProps ?? []).length === 0 &&
            (config.variations ?? []).every((variation) => (variation.styles ?? []).length === 0),
    );

/** Манифест из папки шаблонов; отсутствие файла — базовый шаблон и имена по умолчанию. */
const readComponentManifest = async (componentName: string): Promise<ComponentManifest> => {
    const file = path.join(import.meta.dirname, 'templates', componentName, 'component.json');
    if (!(await fs.pathExists(file))) {
        return {};
    }

    return fs.readJson(file);
};

const writeComponentFiles = async (pathToComponent: string, componentMeta: Meta) => {
    const componentName = componentMeta.name;
    const manifest = await readComponentManifest(componentName);
    const componentDescription = componentMeta.description;
    const configs = componentMeta.sources.configs;

    // Несколько appearance (Tabs): на каждый — свой файл конфига темы в подпапке и обёртка,
    // выбирающая базовый конфиг ядра по пропу из манифеста.
    if (manifest.appearances && 'prop' in manifest.appearances) {
        for await (const { id, name } of configs) {
            await fs.mkdir(`${pathToComponent}/${name}`, { recursive: true });
            const config = new Config(componentMeta, id);
            const componentConfig = createComponentConfig(componentName, config, manifest.coreTokensExport);
            await fs.writeFile(`${pathToComponent}/${getAppearanceConfigFile(name, componentName)}.ts`, componentConfig);
        }
        const names = configs.map(({ name }) => name);
        const wrapper = createAppearanceWrapper(componentName, componentDescription, manifest.appearances, names);
        await fs.writeFile(`${pathToComponent}/${componentName}.tsx`, wrapper);
        return;
    }

    // Один базовый конфиг ядра и выбор appearance пропом (Range): обёртка через
    // `createConditionalComponent`, конфиги темы по прежней схеме `<X>.config.ts` / `<X>.<имя>.config.ts`.
    const conditional = Boolean(manifest.appearances && 'conditional' in manifest.appearances) || configs.length > 1;

    // Компонент без единого значения в ДС (Image, AvatarGroup в sdds-serv): обёртка над базовым
    // конфигом ядра без локального конфига. Пустой конфиг писать нельзя: `mergeConfig` ядра
    // подменяет `variations` целиком, и пустой объект отключил бы все вариации ядра.
    if (isEmptyComponent(componentMeta)) {
        await fs.writeFile(
            `${pathToComponent}/${componentName}.ts`,
            createEmptyComponent(componentName, componentDescription, manifest.coreConfigExport, manifest),
        );
        return;
    }

    // Соседи без конфига темы (ToolbarDivider, DrawerContent): пустые обёртки рядом с компонентом.
    for await (const sibling of manifest.siblings ?? []) {
        await fs.writeFile(`${pathToComponent}/${sibling.name}.ts`, createEmptyComponent(sibling.name, '', sibling.coreConfigExport));
    }

    // Обёртку, которую нельзя вывести из данных (Toast с HOC, Steps с фабрикой конфига),
    // держит шаблон `templates/<X>/<X>.tsx`: он копируется вместе с остальными шаблонами.
    if (await hasWrapperTemplate(componentName)) {
        // конфиги темы всё равно пишутся ниже
    } else if (manifest.generic) {
        await fs.writeFile(
            `${pathToComponent}/${componentName}.tsx`,
            createGenericComponent(componentName, componentDescription, manifest.coreConfigExport, manifest.generic),
        );
    } else if (conditional) {
        await fs.writeFile(
            `${pathToComponent}/${componentName}.ts`,
            createConditionalComponent(componentName, componentDescription, configs.map(({ name }) => name), getPlasmaConfigName(componentName, manifest.coreConfigExport)),
        );
    } else {
        await fs.writeFile(
            `${pathToComponent}/${componentName}.ts`,
            createComponent(componentName, componentDescription, manifest.coreConfigExport, manifest),
        );
    }

    for await (const item of configs) {
        const { id, name } = item;
        const config = new Config(componentMeta, id);
        const componentConfigFileName = name === 'default' ? componentName : `${componentName}.${name}`;

        const componentConfig = createComponentConfig(componentName, config, manifest.coreTokensExport);
        await fs.writeFile(`${pathToComponent}/${componentConfigFileName}.config.ts`, componentConfig);
    }
};

const wrapperTemplateFile = async (componentName: string) => {
    const dir = path.join(import.meta.dirname, 'templates', componentName);
    for (const ext of ['tsx', 'ts']) {
        if (await fs.pathExists(path.join(dir, `${componentName}.${ext}`))) return `${componentName}.${ext}`;
    }
    return null;
};
const hasWrapperTemplate = async (componentName: string) => Boolean(await wrapperTemplateFile(componentName));

/**
 * Дополнительные файлы компонента, которые не выводятся из данных (TabsController у Tabs,
 * шаблон обёртки Toast). Возвращает имена файлов для `export *` в index.ts, без самой обёртки.
 */
const copyComponentTemplates = async (pathToComponent: string, componentName: string) => {
    const templatesDir = path.join(import.meta.dirname, 'templates', componentName);
    if (!(await fs.pathExists(templatesDir))) {
        return [];
    }
    const wrapper = await wrapperTemplateFile(componentName);
    const files = (await fs.readdir(templatesDir)).filter((file) => /\.tsx?$/.test(file));
    for await (const file of files) {
        await fs.copy(path.join(templatesDir, file), path.join(pathToComponent, file));
    }
    return files.filter((file) => file !== wrapper).map((file) => file.replace(/\.tsx?$/, ''));
};

export const generateComponentsFiles = async ({ pathToDir, componentsMeta }: ComponentsFiles) => {
    if (componentsMeta.length === 0) {
        await fs.writeFile(`${pathToDir}/src/index.ts`, createRootIndex([]));
        return;
    }

    const metaByName = new Map(componentsMeta.map((meta) => [meta.name, meta]));
    // Дочерние компоненты (compose) живут в папке родителя и не экспортируются с корня отдельно.
    const childNames = new Set(
        componentsMeta.flatMap((meta) => (meta.deps ?? []).filter((dep) => dep.type === 'compose').map((dep) => dep.childName)),
    );
    const topLevel = componentsMeta.filter((meta) => !childNames.has(meta.name));

    const rootIndex = createRootIndex(topLevel.map((meta) => meta.name));
    await fs.writeFile(`${pathToDir}/src/index.ts`, rootIndex);

    for await (const componentMeta of topLevel) {
        const componentName = componentMeta.name;
        const pathToComponent = `${pathToDir}/src/components/${componentName}`;

        await fs.mkdir(pathToComponent, { recursive: true });
        await writeComponentFiles(pathToComponent, componentMeta);

        const children = (componentMeta.deps ?? [])
            .filter((dep) => dep.type === 'compose' && dep.childName && metaByName.has(dep.childName))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((dep) => dep.childName as string);

        if (children.length === 0) {
            const extras = await copyComponentTemplates(pathToComponent, componentName);
            await fs.writeFile(
                `${pathToComponent}/index.ts`,
                createComponentIndex(componentName, await readComponentManifest(componentName), extras),
            );
            continue;
        }

        for await (const childName of children) {
            await writeComponentFiles(pathToComponent, metaByName.get(childName)!);
        }
        const extras = await copyComponentTemplates(pathToComponent, componentName);
        await fs.writeFile(
            `${pathToComponent}/index.ts`,
            createCompositeIndex(componentName, children, extras, await readComponentManifest(componentName)),
        );
    }
};
