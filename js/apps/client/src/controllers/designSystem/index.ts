import { upperFirstLetter } from '@salutejs/plasma-tokens-utils';

import {
    createMetaTokens,
    createVariationTokens,
    buildDefaultTheme,
    buildTheme,
    type PlatformsVariations,
    type ThemeMeta,
} from '../themeBuilder';
import { Config, resolveStyleReference, type Meta } from '../componentBuilder';
import { kebabToCamel } from '../../utils';
import { Parameters } from '../../types';

interface DesignSystemProps {
    name: string;
    version?: string;
    projectId?: string;
    parameters?: Partial<Parameters>;
    themeData?: ThemeSource;
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
    private composeComponentsData: Meta[] = [];

    private constructor({ name, version = '0.1.0', parameters }: DesignSystemProps) {
        this.name = name;
        this.version = version;
        this.parameters = parameters;

        this.themeData = {} as ThemeSource;
        this.componentsData = [];
    }

    public static fromSnapshot({
        name,
        version,
        parameters,
        themeData,
        componentsData,
        composeComponentsData = [],
    }: DesignSystemProps & { componentsData: Meta[]; composeComponentsData?: Meta[] }) {
        const instance = new DesignSystem({ name, version, parameters });
        instance.themeData = themeData ?? ({} as ThemeSource);
        instance.componentsData = componentsData;
        instance.composeComponentsData = composeComponentsData;
        return instance;
    }

    private generateThemeData(parameters?: Partial<Parameters>) {
        if (!parameters) {
            return {
                meta: {} as ThemeMeta,
                variations: {} as PlatformsVariations,
            };
        }

        const {
            packagesName = 'default',
            accentColor,
            grayTone = 'gray',
            darkStrokeSaturation,
            darkFillSaturation,
            lightStrokeSaturation,
            lightFillSaturation,
        } = parameters;

        const userConfig = {
            name: packagesName,
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

    /**
     * API-метаданные компонента конфигурации с учётом платформы. Compose-компонент ищется только среди Compose-компонентов
     * (имена с web совпадают, а API разный), без подмены чужим компонентом, если его нет.
     */
    public getComponentData(config: Config) {
        if (config.getPlatform() === 'compose') {
            return this.composeComponentsData.find((item) => item.name === config.getName());
        }

        return this.getComponentDataByName(config.getName());
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

    public createAllComposeComponentInstances() {
        return this.composeComponentsData.map((item) => new Config(item));
    }

    /** Разворачивает ссылку на стиль Compose-компонента (`basic-button.xxs.default`). */
    public resolveComposeStyleReference(reference: string) {
        return resolveStyleReference(this.composeComponentsData, reference);
    }

    public createComponentInstance(data: { componentName: string }) {
        const { componentName } = data;

        const componentMeta = this.getComponentDataByName(componentName);
        return new Config(componentMeta);
    }
}
