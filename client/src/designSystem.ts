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

    constructor({ name, version = '0.1.0' }: { name?: string; version?: string }) {
        this.name = name;
        this.version = version;

        this.themeData = this.loadThemeData(name, version);
        this.componentsData = this.loadComponentsData(name, version);

        if (name && version) {
            // TODO: сохранять в бд через api
            saveDesignSystem({
                name,
                version,
                themeData: this.themeData,
                componentsData: this.componentsData,
            });
        }
    }

    // TODO: загружать из бд через api
    private loadThemeData(name?: string, version?: string) {
        const loadedThemeData = name && version ? loadDesignSystem(name, version)?.themeData : undefined;
        const localThemeData = getStaticThemeData(name, version) as unknown as {
            meta: ThemeMeta;
            variations: PlatformsVariations;
        };

        return loadedThemeData ?? localThemeData;
    }

    public saveThemeData(data: { meta: ThemeMeta; variations: PlatformsVariations }) {
        this.themeData = data;

        if (!this.name || !this.version) {
            return;
        }

        // TODO: сохранять в бд через api
        saveDesignSystem({
            name: this.name,
            version: this.version,
            themeData: this.themeData,
            componentsData: this.componentsData,
        });
    }

    // TODO: загружать из бд через api
    private loadComponentsData(name?: string, version?: string) {
        const loadedComponentsData = name && version ? loadDesignSystem(name, version)?.componentsData : undefined;
        const localComponentsData = componentsData as Meta[];

        return loadedComponentsData ?? localComponentsData;
    }

    public saveComponentsData(data: { meta: Meta }) {
        const { meta } = data;
        const { name } = meta;

        const componentName = name;
        const componentIndex = this.componentsData?.findIndex(({ name }) => name === componentName);

        this.componentsData[componentIndex] = meta;

        if (!this.name || !this.version) {
            return;
        }

        // TODO: сохранять в бд через api
        saveDesignSystem({
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
