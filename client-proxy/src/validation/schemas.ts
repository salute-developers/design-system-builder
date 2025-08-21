import { z } from 'zod';

// Core generic types that are used in schemas
export const VariationsSchema = z.object({
    color: z.any(),
    gradient: z.any(),
    shape: z.any(),
    shadow: z.any(),
    spacing: z.any(),
    typography: z.any(),
    fontFamily: z.any(),
});

// Basic types
export const PropTypeSchema = z.enum(['color', 'dimension', 'float', 'shape', 'typography']);
export const PropStateSchema = z.enum(['hovered', 'pressed']);
export const IntersectionsSchema = z.record(z.string(), z.array(z.string()));

// Platform and token schemas
export const WebTokenSchema = z.object({
    name: z.string(),
    adjustment: z.string().nullable(),
});

export const PlatformTokensSchema = z.object({
    xml: z.string().nullable(),
    compose: z.string().nullable(),
    ios: z.string().nullable(),
    web: z.array(WebTokenSchema).nullable(),
});

// Component API schema
export const ComponentAPISchema = z.object({
    id: z.string(),
    name: z.string(),
    type: PropTypeSchema,
    description: z.string().optional(),
    variations: z.array(z.string()).nullable(), // Array of IDs, not names
    platformMappings: PlatformTokensSchema,
});

// Component variation schema
export const ComponentVariationSchema = z.object({
    id: z.string(),
    name: z.string(),
});

// Configuration schemas
export const DefaultVariationConfigSchema = z.object({
    variationID: z.string(),
    styleID: z.string(),
});

export const StateSchema = z.object({
    state: z.array(PropStateSchema),
    value: z.string().optional(),
});

export const PropConfigSchema = z.object({
    id: z.string(),
    value: z.union([z.string(), z.number()]).optional(),
    states: z.array(StateSchema).nullable().optional(),
    adjustment: z.union([z.string(), z.number()]).optional(),
});

export const StyleConfigSchema = z.object({
    name: z.string(),
    id: z.string(),
    intersections: IntersectionsSchema.nullable(),
    props: z.array(PropConfigSchema).nullable(),
});

export const VariationConfigSchema = z.object({
    id: z.string(),
    styles: z.array(StyleConfigSchema).optional(),
});

export const ComponentConfigSchema = z.object({
    defaultVariations: z.array(DefaultVariationConfigSchema),
    invariantProps: z.array(PropConfigSchema),
    variations: z.array(VariationConfigSchema),
});

export const ConfigSchema = z.object({
    name: z.string(),
    id: z.string(),
    config: ComponentConfigSchema,
});

// Sources schema
export const SourcesSchema = z.object({
    api: z.array(ComponentAPISchema),
    variations: z.array(ComponentVariationSchema),
    configs: z.array(ConfigSchema),
});

// Meta schema
export const MetaSchema = z.object({
    name: z.string(),
    description: z.string(),
    sources: SourcesSchema,
});

// Theme-related schemas
export const TokenTypeSchema = z.object({
    type: z.string(), // Can be any string, not just the enum values
    name: z.string(),
    tags: z.array(z.string()),
    displayName: z.string(),
    description: z.string().optional(),
    enabled: z.boolean(),
});

// Meta variations schemas
export const ColorMetaSchema = z.object({
    mode: z.array(z.string()),
    category: z.array(z.string()),
    subcategory: z.array(z.string()),
});

export const GradientMetaSchema = z.object({
    mode: z.array(z.string()),
    category: z.array(z.string()),
    subcategory: z.array(z.string()),
});

export const ShadowMetaSchema = z.object({
    direction: z.array(z.string()),
    kind: z.array(z.string()),
    size: z.array(z.string()),
});

export const ShapeMetaSchema = z.object({
    kind: z.array(z.string()),
    size: z.array(z.string()),
});

export const SpacingMetaSchema = z.object({
    kind: z.array(z.string()),
    size: z.array(z.string()),
});

export const TypographyMetaSchema = z.object({
    screen: z.array(z.string()),
    kind: z.array(z.string()),
    size: z.array(z.string()),
    weight: z.array(z.string()),
});

export const FontFamilyMetaSchema = z.object({
    kind: z.array(z.string()),
});

// Theme meta schema
export const ThemeMetaSchema = z.object({
    name: z.string(),
    version: z.string(),
    tokens: z.array(TokenTypeSchema),
    color: ColorMetaSchema,
    gradient: GradientMetaSchema,
    shadow: ShadowMetaSchema,
    shape: ShapeMetaSchema,
    spacing: SpacingMetaSchema,
    typography: TypographyMetaSchema,
    fontFamily: FontFamilyMetaSchema,
});

// Platform variations schema - flexible structure for different token types
export const PlatformsSchema = z.object({
    web: z.record(z.string(), z.unknown()), // Values can be strings, arrays, etc.
    ios: z.record(z.string(), z.unknown()),
    android: z.record(z.string(), z.unknown()),
});

export const PlatformsVariationsSchema = z.object({
    color: PlatformsSchema, // Direct platform mapping, not nested with modes
    gradient: PlatformsSchema,
    shadow: PlatformsSchema,
    shape: PlatformsSchema,
    spacing: PlatformsSchema,
    typography: PlatformsSchema,
    fontFamily: PlatformsSchema,
});

// Theme source schema
export const ThemeSourceSchema = z.object({
    meta: ThemeMetaSchema,
    variations: PlatformsVariationsSchema,
});

// Main design system data schema
export const DesignSystemDataSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    version: z.string().min(1, 'Version is required'),
    themeData: ThemeSourceSchema,
    componentsData: z.array(MetaSchema),
});

// API response schemas
export const ApiResponseSchema = z.object({
    success: z.boolean().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
    details: z.string().optional(),
    path: z.string().optional(),
});

export const HealthResponseSchema = z.object({
    status: z.string(),
    message: z.string(),
});

// Design system tuple schema
export const DesignSystemTupleSchema = z.tuple([z.string(), z.string()]);

// // Stored design system schema
// export const StoredDesignSystemSchema = z.object({
//     themeData: ThemeSourceSchema,
//     componentsData: z.array(MetaSchema),
//     savedAt: z.string(),
// });

// // Export all inferred types to replace manual TypeScript types
// export type PropType = z.infer<typeof PropTypeSchema>;
// export type PropState = z.infer<typeof PropStateSchema>;
// export type Intersections = z.infer<typeof IntersectionsSchema>;

// export type WebToken = z.infer<typeof WebTokenSchema>;
// export type PlatformTokens = z.infer<typeof PlatformTokensSchema>;

// export type ComponentAPI = z.infer<typeof ComponentAPISchema>;
// export type ComponentVariation = z.infer<typeof ComponentVariationSchema>;
// export type DefaultVariationConfig = z.infer<typeof DefaultVariationConfigSchema>;
// export type State = z.infer<typeof StateSchema>;
// export type PropConfig = z.infer<typeof PropConfigSchema>;
// export type StyleConfig = z.infer<typeof StyleConfigSchema>;
// export type VariationConfig = z.infer<typeof VariationConfigSchema>;
// export type ComponentConfig = z.infer<typeof ComponentConfigSchema>;
// export type Config = z.infer<typeof ConfigSchema>;
// export type Sources = z.infer<typeof SourcesSchema>;
// export type Meta = z.infer<typeof MetaSchema>;

// export type TokenType = z.infer<typeof TokenTypeSchema>;
// export type ColorMeta = z.infer<typeof ColorMetaSchema>;
// export type GradientMeta = z.infer<typeof GradientMetaSchema>;
// export type ShadowMeta = z.infer<typeof ShadowMetaSchema>;
// export type ShapeMeta = z.infer<typeof ShapeMetaSchema>;
// export type SpacingMeta = z.infer<typeof SpacingMetaSchema>;
// export type TypographyMeta = z.infer<typeof TypographyMetaSchema>;
// export type FontFamilyMeta = z.infer<typeof FontFamilyMetaSchema>;
// export type ThemeMeta = z.infer<typeof ThemeMetaSchema>;

// export type Variations = z.infer<typeof VariationsSchema>;
// export type Variation = keyof Variations;
// export type Platform = 'web' | 'ios' | 'android';
// export type Platforms = z.infer<typeof PlatformsSchema>;
// export type PlatformsVariations = z.infer<typeof PlatformsVariationsSchema>;
// export type ThemeSource = z.infer<typeof ThemeSourceSchema>;

// Schemas for separate file storage
export const StoredThemeDataSchema = z.object({
    themeData: ThemeSourceSchema,
    savedAt: z.string()
});

export const StoredComponentsDataSchema = z.object({
    componentsData: z.array(MetaSchema),
    savedAt: z.string()
});

export type DesignSystemData = z.infer<typeof DesignSystemDataSchema>;
// export type StoredDesignSystem = z.infer<typeof StoredDesignSystemSchema>;
export type StoredThemeData = z.infer<typeof StoredThemeDataSchema>;
export type StoredComponentsData = z.infer<typeof StoredComponentsDataSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type DesignSystemTuple = z.infer<typeof DesignSystemTupleSchema>;
