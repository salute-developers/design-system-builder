import type {
    ColorProp,
    DimensionProp,
    FloatProp,
    IconProp,
    ShadowProp,
    ShapeProp,
    StyleReferenceProp,
    TypographyProp,
    ValueProp,
} from './props';

export const DEFAULT_FONT_SIZE = 16;

// type ConfigTokenFields<T extends ConfigToken> = {
//     [K in Exclude<keyof T, 'name'>]: T[K];
// };

// export interface DynamicConfig {
//     defaults: {
//         [k: string]: string | boolean;
//     };
//     variations?: {
//         [k: string]: {
//             [k: string]: PolymorphicClassName;
//         };
//     };
//     invariants?: PolymorphicClassName;
// }

// ТИПЫ ПО ФАЙЛАМ

export type PropType =
    | 'color'
    | 'dimension'
    | 'float'
    /** Иконка: имя в формате данных (`disclosure.down.fill.16`). */
    | 'icon'
    | 'shadow'
    | 'shape'
    | 'typography'
    | 'value'
    /** Ссылка на стиль другого компонента: `<конфигурация>.<стиль>.<стиль>`. */
    | 'component_style';

export type PropState = 'hovered' | 'pressed'; //| 'disabled' | 'loading' | 'focused';

export type Intersections = Record<string, string[]>;

export type PropUnion =
    | ColorProp
    | FloatProp
    | IconProp
    | ShadowProp
    | ShapeProp
    | DimensionProp
    | TypographyProp
    | ValueProp
    | StyleReferenceProp;

export interface WebToken {
    name: string;
    adjustment: string | null;
}

export interface PlatformTokens {
    xml: string | null;
    compose: string | null;
    ios: string | null;
    web: WebToken[] | null;
}

export interface ComponentAPI {
    id: string;
    name: string;
    type: PropType;
    description?: string;
    variations: string[] | null;
    platformMappings: PlatformTokens;
}

export interface ComponentVariation {
    id: string;
    name: string;
}

export interface DefaultVariationConfig {
    variationID: string;
    styleID: string;
}

export interface State {
    state: PropState[];
    value?: string;
    /** Прозрачность значения 0..1; в Compose-превью накладывается на цвет или градиент. */
    alpha?: number;
}

export interface PropConfig {
    id: string;
    value?: string | number;
    states?: State[] | null;
    adjustment?: string | number;
    /** Прозрачность значения 0..1; в Compose-превью накладывается на цвет или градиент. */
    alpha?: number;
}

export interface StyleConfig {
    name: string;
    id: string;
    intersections: Intersections | null;
    props: PropConfig[] | null;
}

export interface VariationConfig {
    id: string;
    styles?: StyleConfig[];
}

/** Значения свойств под сочетанием стилей нескольких вариаций. */
export interface CombinationConfig {
    styleIDs: string[];
    props: PropConfig[];
}

export interface ComponentConfig {
    defaultVariations: DefaultVariationConfig[];
    invariantProps: PropConfig[];
    variations: VariationConfig[];
    combinations?: CombinationConfig[];
}

export interface ComponentDep {
    childId: string;
    childName: string | null;
    type: 'compose' | 'reuse';
    order: number | null;
}

export interface Config {
    name: string;
    id: string;
    config: ComponentConfig;
}

export interface Sources {
    api: ComponentAPI[];
    variations: ComponentVariation[];
    configs: Config[];
}

export type ComponentPlatform = 'web' | 'compose';

export interface Meta {
    name: string;
    description: string;
    /** Платформа компонента; без значения — `web`. Проставляется клиентом при загрузке. */
    platform?: ComponentPlatform;
    deps?: ComponentDep[];
    preview?: {
        compose?: {
            componentId: string;
            storyId: string;
        };
    };
    sources: Sources;
    /** Устойчивые идентификаторы серверной конфигурации, необходимые для предметного автосохранения. */
    serverBinding?: {
        componentId: string;
        appearanceId: string;
        /** Краткие имена оформлений для разрешения вложенного компонента без чтения всего каталога. */
        appearanceNames?: string[];
    };
}

export interface ThemeValues {
    getTokenValue(name: string, type: 'color' | 'shape' | 'shadow' | 'typography' | 'fontFamily', platform: 'web'): any;
}

export type WebTokenValues = Record<string, string>;
