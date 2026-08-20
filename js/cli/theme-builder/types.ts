export type Variation = 'color' | 'fontFamily' | 'gradient' | 'shadow' | 'shape' | 'spacing' | 'typography';
export type ThemeMode = 'dark' | 'light';

export interface ThemeToken {
    type: Variation;
    name: string;
    tags: string[];
    displayName: string;
    description?: string;
    enabled: boolean;
}

export interface ThemeMeta {
    name: string;
    version: string;
    tokens: ThemeToken[];
}

interface TypographyValue {
    fontFamilyRef: string;
    fontSize: string;
    fontStyle: string;
    fontWeight: string;
    letterSpacing: string;
    lineHeight: string;
}

interface FontFamilyValue {
    name: string;
}

export interface ThemeVariations {
    color: Record<string, string>;
    fontFamily: Record<string, FontFamilyValue>;
    gradient: Record<string, string | string[]>;
    shadow: Record<string, string[]>;
    shape: Record<string, string>;
    spacing: Record<string, string>;
    typography: Record<string, TypographyValue>;
}

export type Palette = Record<string, Record<string, string>>;
export type MetaGrouped = Partial<Record<Variation, ThemeToken[]>>;

export interface ModeTokens<T> {
    dark: T;
    light: T;
}

export interface TypographyTokens {
    root: string;
    screenS: string;
    screenM: string;
    screenL: string;
}

export interface TokensContent {
    colorTokens: string;
    gradientTokens: string;
    shadowTokens: string;
    shapeTokens: string;
    spacingTokens: string;
    typographyTokens: TypographyTokens;
}

export interface ThemeContent {
    dark: TokensContent;
    light: TokensContent;
}
