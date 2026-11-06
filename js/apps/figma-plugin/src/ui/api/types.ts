/** Ответы `ds-service`: только поля, которые нужны плагину. */

export interface ProjectDto {
    id: string;
    name: string;
    description?: string | null;
}

export interface DesignSystemDto {
    id: string;
    name: string;
    description?: string | null;
}

export interface TenantDto {
    id: string;
    name: string | null;
}

export interface DesignSystemVersionDto {
    id: string;
    version: string;
    sequenceNumber: number;
    publishedAt?: string | null;
}

export interface TokenDefinitionDto {
    id: string;
    name: string;
    type: string;
    displayName?: string | null;
    description?: string | null;
    enabled: boolean;
}

export interface TokenValueDto {
    tokenId: string;
    platform: 'web' | 'ios' | 'android' | null;
    mode: 'light' | 'dark' | null;
    value: unknown;
}

export interface TypographyStyleDto {
    group: string;
    size: string;
    sizePx: number;
    lineHeightPx: number;
    letterSpacingEm: number;
    fontFamily: string;
    variants: Partial<Record<'normal' | 'medium' | 'bold', { tokenId: string; weight: number }>>;
}

export type TypographyScreenId = 'screen-l' | 'screen-m' | 'screen-s';

export interface TypographyStylesDto {
    families: Array<{ name: string; fontName: string }>;
    screens: Array<{ screen: TypographyScreenId; styles: TypographyStyleDto[] }>;
}

export interface DimensionTokenDto {
    tokenId: string;
    name: string;
    valuePx: number | null;
    fullRounding?: boolean;
}

export interface ShadowLayerDto {
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    color: string;
}

export interface ShadowTokenDto {
    tokenId: string;
    name: string;
    layers: ShadowLayerDto[];
}

export interface SizeTokensDto {
    radii?: DimensionTokenDto[];
    spacing?: DimensionTokenDto[];
    shadows?: ShadowTokenDto[];
}
