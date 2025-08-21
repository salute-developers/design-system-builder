// Shared types derived from client sources

export interface Variations<
    T1 extends any = any,
    T2 extends any = any,
    T3 extends any = any,
    T4 extends any = any,
    T5 extends any = any,
    T6 extends any = any,
    T7 extends any = any
> {
    color: T1;
    gradient: T2;
    shape: T4;
    shadow: T3;
    spacing: T5;
    typography: T6;
    fontFamily: T7;
}

export interface Platforms<
    T1 extends Record<string, any> = Record<string, any>,
    T2 extends Record<string, any> = Record<string, any>,
    T3 extends Record<string, any> = Record<string, any>
> {
    web: T1;
    ios: T2;
    android: T3;
}

export type Variation = keyof Variations;
export type Platform = keyof Platforms;

export interface TokenType {
    type: Variation;
    name: string;
    tags: Array<string>;
    displayName: string;
    description?: string;
    enabled: boolean;
}

// Meta types
export type ColorMeta = Record<'mode' | 'category' | 'subcategory', Array<string>>;
export type GradientMeta = Record<'mode' | 'category' | 'subcategory', Array<string>>;
export type ShadowMeta = Record<'direction' | 'kind' | 'size', Array<string>>;
export type ShapeMeta = Record<'kind' | 'size', Array<string>>;
export type SpacingMeta = Record<'kind' | 'size', Array<string>>;
export type TypographyMeta = Record<'screen' | 'kind' | 'size' | 'weight', Array<string>>;
export type FontFamilyMeta = Record<'kind', Array<string>>;

export type MetaVariations = Variations<
    ColorMeta,
    GradientMeta,
    ShadowMeta,
    ShapeMeta,
    SpacingMeta,
    TypographyMeta,
    FontFamilyMeta
>;

export interface ThemeMeta extends MetaVariations {
    name: string;
    version: string;
    tokens: Array<TokenType>;
}

// Platform variations type - more flexible to handle different variation structures
export type PlatformsVariations = Variations<
    Record<string, Platforms<Record<string, string>>>, // color variations (dark, light, etc.)
    Platforms<Record<string, string>>, // gradient
    Platforms<Record<string, string>>, // shadow  
    Platforms<Record<string, string>>, // shape
    Platforms<Record<string, string>>, // spacing
    Platforms<Record<string, string>>, // typography
    Platforms<Record<string, string>>  // fontFamily
>;

// Theme source interface (from designSystem.ts)
export interface ThemeSource {
    meta: ThemeMeta;
    variations: PlatformsVariations;
}

// Component builder types (from componentBuilder/type.ts)
export type PropType = 'color' | 'dimension' | 'float' | 'shape' | 'typography';
export type PropState = 'hover' | 'pressed';
export type Intersections = Record<string, string[]>;

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

export interface ComponentConfig {
    defaultVariations: DefaultVariationConfig[];
    invariantProps: PropConfig[];
    variations: VariationConfig[];
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
    sources: Sources;
}

// Design system data structure for API
export interface DesignSystemData {
    name: string;
    version: string;
    themeData: ThemeSource;
    componentsData: Array<Meta>;
}

// Stored design system (includes savedAt timestamp)
export interface StoredDesignSystem {
    themeData: ThemeSource;
    componentsData: Array<Meta>;
    savedAt: string;
}

// API response types
export interface ApiResponse<T = any> {
    success?: boolean;
    message?: string;
    error?: string;
    details?: string;
    data?: T;
    path?: string; // For 404 errors
}

export interface HealthResponse {
    status: string;
    message: string;
}

// Design system name/version tuple
export type DesignSystemTuple = readonly [string, string];
