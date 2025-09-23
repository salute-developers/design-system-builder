import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

// TODO: загружать из бд
import { componentsData, getStaticThemeData } from './pseudo_data_base';

import { buildTheme, type Platform, type PlatformsVariations, type ThemeMeta } from './themeBuilder';
import { Config, type Meta } from './componentBuilder';
import { kebabToCamel, loadDesignSystem, saveDesignSystem } from './_new/utils';

export interface ThemeSource {
    meta: ThemeMeta;
    variations: PlatformsVariations;
}

export class DesignSystem {
    private name?: string;
    private version?: string;

    private themeData: ThemeSource;
    private componentsData: Meta[] = [];

    private constructor({ name, version = '0.1.0' }: { name?: string; version?: string }) {
        this.name = name;
        this.version = version;

        // Initialize with empty/default values - actual loading happens in create method
        this.themeData = {} as ThemeSource;
        this.componentsData = [];
    }

    public static async create({
        name,
        version = '0.1.0',
    }: {
        name?: string;
        version?: string;
    }): Promise<DesignSystem> {
        const instance = new DesignSystem({ name, version });

        // Load data (from storage if available, otherwise from local sources)
        const { themeData, componentsData } = await instance.loadData(name, version);
        instance.themeData = themeData;
        instance.componentsData = componentsData;

        // Save to storage after loading (in case we loaded from local data)
        if (name && version) {
            await saveDesignSystem({
                name,
                version,
                themeData: instance.themeData,
                componentsData: instance.componentsData,
            });
        }

        return instance;
    }

    public static async get({ name, version = '0.1.0' }: { name?: string; version?: string }): Promise<DesignSystem> {
        const instance = new DesignSystem({ name, version });

        // Load data (from storage if available, otherwise from local sources)
        const { themeData, componentsData } = await instance.loadData(name, version);
        instance.themeData = themeData;
        instance.componentsData = componentsData;

        return instance;
    }

    private async loadData(name?: string, version?: string) {
        const loadedData = name && version ? await loadDesignSystem(name, version) : undefined;
        const localData = {
            themeData: getStaticThemeData(name, version) as unknown as {
                meta: ThemeMeta;
                variations: PlatformsVariations;
            },
            componentsData: componentsData as Meta[],
        };

        if (!loadedData) {
            return localData;
        }

        if (!loadedData.themeData && loadedData.componentsData) {
            return {
                themeData: localData.themeData,
                componentsData: loadedData.componentsData,
            };
        }

        if (loadedData.themeData && !loadedData.componentsData) {
            return {
                themeData: loadedData.themeData,
                componentsData: localData.componentsData,
            };
        }

        return loadedData;
    }

    public async saveThemeData(data: { meta: ThemeMeta; variations: PlatformsVariations }) {
        this.themeData = data;

        if (!this.name || !this.version) {
            return;
        }

        // TODO: сохранять в бд через api
        await saveDesignSystem({
            name: this.name,
            version: this.version,
            themeData: this.themeData,
            componentsData: this.componentsData,
        });
    }

    public async saveComponentsData(data: { meta: Meta }) {
        const { meta } = data;
        const { name } = meta;

        const componentName = name;
        const componentIndex = this.componentsData?.findIndex(({ name }) => name === componentName);

        this.componentsData[componentIndex] = meta;

        if (!this.name || !this.version) {
            return;
        }

        // TODO: сохранять в бд через api
        await saveDesignSystem({
            name: this.name,
            version: this.version,
            themeData: this.themeData,
            componentsData: this.componentsData,
        });
    }

    public getName() {
        return this.name;
    }

    public setName(value: string) {
        this.name = value;
    }

    public getVersion() {
        return this.version;
    }

    public setVersion(value: string) {
        this.version = value;
    }

    public getComponentDataByName(name?: string) {
        const componentName = upperFirstLetter(kebabToCamel(name));
        const componentData = this.componentsData?.find((item) => item.name === componentName);

        return componentData || this.componentsData[0];
    }

    public getComponentsData() {
        return this.componentsData;
    }

    public getThemeData(platform?: Platform) {
        if (!platform) {
            return this.themeData.variations;
        }

        const { meta, variations } = this.themeData;

        const variationsByPlatform = Object.entries(variations).reduce(
            (acc, [variation, value]) => ({ ...acc, [variation]: value[platform] }),
            {},
        ) as Record<keyof typeof variations, typeof platform>;

        return {
            meta,
            variations: variationsByPlatform,
        };
    }

    public createThemeInstance(data?: { includeExtraTokens?: boolean }) {
        return buildTheme(this.themeData.meta, this.themeData.variations, data?.includeExtraTokens);
    }

    public createComponentInstance(data: { componentName: string }) {
        const { componentName } = data;

        const componentMeta = this.getComponentDataByName(componentName);
        return new Config(componentMeta);
    }
}
