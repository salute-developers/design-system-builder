import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import { componentsData, themeData } from './pseudo_data_base';

import { buildTheme, type PlatformsVariations, type ThemeMeta } from './themeBuilder';
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
        const localThemeData = themeData as unknown as {
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

    public saveComponentsData(data: { meta: Meta; name?: string }) {
        const { meta, name } = data;

        const componentName = upperFirstLetter(kebabToCamel(name));
        const componentIndex = this.componentsData?.findIndex((item) => item.name === componentName);

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

    private getComponentDataByName(name?: string) {
        const componentName = upperFirstLetter(kebabToCamel(name));
        const componentData = this.componentsData?.find((item) => item.name === componentName);

        return componentData || this.componentsData[0];
    }

    public getThemeData() {
        return this.themeData;
    }

    public getComponentsData() {
        return this.componentsData;
    }

    public createThemeInstance(data?: { includeExtraTokens?: boolean }) {
        return buildTheme(this.themeData.meta, this.themeData.variations, data?.includeExtraTokens);
    }

    public createComponentInstance(data?: { name?: string }) {
        const componentMeta = this.getComponentDataByName(data?.name);
        return new Config(componentMeta);
    }
}
