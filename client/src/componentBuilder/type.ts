import type { ColorProp, DimensionProp, FloatProp, ShapeProp, TypographyProp } from './props';

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

export type PropType = 'color' | 'dimension' | 'float' | 'shape' | 'typography';

export type PropState = 'hover' | 'pressed'; //| 'disabled' | 'loading' | 'focused';

export type Intersections = Record<string, string[]>;

export type PropUnion = ColorProp | FloatProp | ShapeProp | DimensionProp | TypographyProp;

export interface WebToken {
    name: string;
    adjustment: string | null;
}

export interface PlatformMapping {
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
    platformMappings: PlatformMapping;
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
    value: string;
}

export interface PropConfig {
    id: string;
    value?: string | number;
    states?: State[] | null;
    adjustment?: string | number;
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

export interface ComponentConfig {
    defaultVariations: DefaultVariationConfig[];
    invariantProps: PropConfig[];
    variations: VariationConfig[];
}

export type StaticAPI = {
    name: string;
    id: string;
    value: string | boolean;
    items?: {
        id: string;
        value: string;
        label: string;
    }[];
};

export interface Source {
    staticAPI?: StaticAPI[];
    api: ComponentAPI[];
    variations: ComponentVariation[];
    config: ComponentConfig;
}

export interface Meta {
    name: string;
    description: string;
    sources: Source;
}
