import type { Platform, Variation, Variations } from './token';

import {
    type ColorPlatforms,
    ColorToken,
    type FontFamilyPlatforms,
    FontFamilyToken,
    type GradientPlatforms,
    GradientToken,
    type ShadowPlatforms,
    ShadowToken,
    type ShapePlatforms,
    ShapeToken,
    type SpacingPlatforms,
    SpacingToken,
    type TypographyPlatforms,
    TypographyToken,
} from '../tokens';

export type PlatformsVariations = Variations<
    ColorPlatforms,
    GradientPlatforms,
    ShadowPlatforms,
    ShapePlatforms,
    SpacingPlatforms,
    TypographyPlatforms,
    FontFamilyPlatforms
>;

export type TokenVariations = Variations<
    ColorToken,
    GradientToken,
    ShadowToken,
    ShapeToken,
    SpacingToken,
    TypographyToken,
    FontFamilyToken
>;

export type VariationsClasses = {
    [key in keyof TokenVariations]: Array<TokenVariations[key]>;
};

export type PlatformsByVariationsMap<T extends Variation = Variation, U extends Platform = Platform> = {
    [key in U]: PlatformsVariations[T][key][string];
};
