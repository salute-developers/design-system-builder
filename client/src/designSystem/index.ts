import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

// TODO: загружать из бд
import { componentsData } from '../_pseudo_data_base';

import {
    createMetaTokens,
    createVariationTokens,
    buildDefaultTheme,
    buildTheme,
    type PlatformsVariations,
    type ThemeMeta,
} from '../themeBuilder';
import { Config, type Meta } from '../componentBuilder';
import { kebabToCamel, loadDesignSystem, saveDesignSystem } from '../_new/utils';
import { Parameters } from '../_new/types';

interface DesignSystemProps {
    name?: string;
    version?: string;
    parameters?: Partial<Parameters>;
}

export interface ThemeSource {
    meta: ThemeMeta;
    variations: PlatformsVariations;
}

export class DesignSystem {
    private name?: string;
    private version?: string;
    private parameters?: Partial<Parameters>;

    private themeData: ThemeSource;
    private componentsData: Meta[] = [];

    private constructor({ name, parameters }: DesignSystemProps) {
        this.name = name;
        this.version = '0.1.0';
        this.parameters = parameters;

        this.themeData = {} as ThemeSource;
        this.componentsData = [];
    }

    public static async create({ name, version = '0.1.0', parameters }: DesignSystemProps): Promise<DesignSystem> {
        const instance = new DesignSystem({ name, version, parameters });

        const { themeData, componentsData } = await instance.loadData({ name, version, parameters });
        instance.themeData = themeData;
        instance.componentsData = componentsData;

        if (name && version) {
            await saveDesignSystem({
                name,
                version,
                parameters,
                themeData: instance.themeData,
                componentsData: instance.componentsData,
            });
        }

        return instance;
    }

    public static async get({ name, version = '0.1.0' }: DesignSystemProps): Promise<DesignSystem> {
        const instance = new DesignSystem({ name, version });

        const { themeData, componentsData, parameters } = await instance.loadData({ name, version });
        instance.themeData = themeData;
        instance.componentsData = componentsData;
        instance.parameters = parameters;

        return instance;
    }

    private async loadData({ name, version = '0.1.0', parameters }: DesignSystemProps) {
        const loadedData = name && version ? await loadDesignSystem(name, version) : undefined;

        // TODO: попробовать убрать
        if (!loadedData) {
            return {
                themeData: this.generateThemeData(parameters),
                componentsData: this.generateComponentData(),
            };
        }

        return loadedData;
    }

    private generateComponentData() {
        return componentsData as Meta[];
    }

    private generateThemeData(parameters?: Partial<Parameters>) {
        if (!parameters) {
            return {
                meta: {} as ThemeMeta,
                variations: {} as PlatformsVariations,
            };
        }

        const {
            projectName = 'default',
            accentColor,
            grayTone = 'gray',
            darkStrokeSaturation,
            darkFillSaturation,
            lightStrokeSaturation,
            lightFillSaturation,
        } = parameters;

        const userConfig = {
            name: projectName,
            strokeAccentColor: {
                dark: `[general.${accentColor}.${darkStrokeSaturation}]`,
                light: `[general.${accentColor}.${lightStrokeSaturation}]`,
            },
            fillAccentColor: {
                dark: `[general.${accentColor}.${darkFillSaturation}]`,
                light: `[general.${accentColor}.${lightFillSaturation}]`,
            },
            grayscale: {
                dark: grayTone,
                light: grayTone,
            },
        };
        const defaultTheme = buildDefaultTheme(userConfig);

        return {
            meta: createMetaTokens(defaultTheme),
            variations: createVariationTokens(defaultTheme),
        };
    }

    public async saveThemeData(data: { meta: ThemeMeta; variations: PlatformsVariations }) {
        this.themeData = data;

        if (!this.name || !this.version) {
            return;
        }

        await saveDesignSystem({
            name: this.name,
            version: this.version,
            parameters: this.parameters,
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

        await saveDesignSystem({
            name: this.name,
            version: this.version,
            parameters: this.parameters,
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

    public getParameters() {
        return this.parameters;
    }

    public getComponentDataByName(name?: string) {
        const componentName = upperFirstLetter(kebabToCamel(name));
        const componentData = this.componentsData?.find((item) => item.name === componentName);

        return componentData || this.componentsData[0];
    }

    public getComponentsData() {
        return this.componentsData;
    }

    public createThemeInstance(data?: { includeExtraTokens?: boolean }) {
        return buildTheme(this.themeData.meta, this.themeData.variations, data?.includeExtraTokens);
    }

    public createAllComponentInstances() {
        return this.componentsData.map((item) => new Config(item));
    }

    public createComponentInstance(data: { componentName: string }) {
        const { componentName } = data;

        const componentMeta = this.getComponentDataByName(componentName);
        return new Config(componentMeta);
    }
}
