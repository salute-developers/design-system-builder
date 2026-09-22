import type { ColorProp, DimensionProp, FloatProp, ShadowProp, ShapeProp, TypographyProp, ValueProp } from './props';

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

export type PropType = 'color' | 'dimension' | 'float' | 'shadow' | 'shape' | 'typography' | 'value';

export type PropState = 'hovered' | 'pressed'; //| 'disabled' | 'loading' | 'focused';

export type Intersections = Record<string, string[]>;

export type PropUnion = ColorProp | FloatProp | ShadowProp | ShapeProp | DimensionProp | TypographyProp | ValueProp;

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

export interface Meta {
    name: string;
    description: string;
    deps?: ComponentDep[];
    sources: Sources;
}


export interface ThemeValues {
    getTokenValue(name: string, type: 'color' | 'shape' | 'shadow' | 'typography' | 'fontFamily', platform: 'web'): any;
}

export type WebTokenValues = Record<string, string>;
