/** Экран, для которого заданы стили: от крупного к мелкому. */
export type TypographyScreen = 'screen-l' | 'screen-m' | 'screen-s';

/** Начертание стиля: стиль состоит из трёх токенов, которые отличаются весом. */
export type TypographyVariant = 'normal' | 'medium' | 'bold';

export const TYPOGRAPHY_SCREENS: ReadonlyArray<{ id: TypographyScreen; label: string }> = [
    { id: 'screen-l', label: 'Крупные' },
    { id: 'screen-m', label: 'Средние' },
    { id: 'screen-s', label: 'Мелкие' },
];

export const TYPOGRAPHY_VARIANTS: ReadonlyArray<{ id: TypographyVariant; label: string }> = [
    { id: 'normal', label: 'Regular' },
    { id: 'medium', label: 'Medium' },
    { id: 'bold', label: 'Bold' },
];

export type TypographyPlatform = 'web' | 'ios' | 'android';

/** Техническая редакция значения токена темы на платформе: базовая редакция следующей правки. */
export interface TypographyValueRevision {
    platform: TypographyPlatform;
    /** Устойчивый идентификатор значения. */
    valueId: string;
    revision: number;
}

/** Начертание стиля на экране: токен, вес и технические редакции его значений. */
export interface TypographyVariantView {
    tokenId: string;
    weight: number;
    valueRevisions: TypographyValueRevision[];
}

/** Компонент, который использует стиль, и число значений свойств со ссылкой. */
export interface TypographyComponentUsage {
    name: string;
    count: number;
}

/** Стиль типографии на экране в единицах редактора. */
/** Платформа, которая может задать своё значение вместо построенного из веба. */
export type TypographyOverridePlatform = 'ios' | 'android';

export const TYPOGRAPHY_OVERRIDE_PLATFORMS: ReadonlyArray<{ id: TypographyOverridePlatform; label: string }> = [
    { id: 'ios', label: 'iOS' },
    { id: 'android', label: 'Android' },
];

/** Свои значения платформы у стиля: только поля, которые отличаются от веба. */
export interface TypographyOverride {
    sizePx?: number;
    lineHeightPx?: number;
    letterSpacingEm?: number;
    weights?: Partial<Record<TypographyVariant, number>>;
}

export interface TypographyStyle {
    screen: TypographyScreen;
    group: string;
    size: string;
    sizePx: number;
    lineHeightPx: number;
    letterSpacingEm: number;
    /** Имя токена `fontFamily` без префикса. */
    fontFamily: string;
    variants: Partial<Record<TypographyVariant, TypographyVariantView>>;
    components: TypographyComponentUsage[];
    /** Свои значения iOS и Android; нет платформы — все её поля строятся из веба. */
    overrides?: Partial<Record<TypographyOverridePlatform, TypographyOverride>>;
}

/** Семейство шрифта дизайн-системы. */
export interface TypographyFamily {
    name: string;
    fontName: string;
}

/** Стили темы для раздела «Типографика». */
export interface TypographyStyles {
    /** Право правки темы и активный черновик; `false` для опубликованной версии. */
    canEdit: boolean;
    themeCount: number;
    families: TypographyFamily[];
    screens: Array<{ screen: TypographyScreen; styles: TypographyStyle[] }>;
}

/** Правка стиля: размеры — на экране токена, веса и семейство — на всех экранах. */
export interface TypographyStyleChange {
    /** Своё значение платформы: размеры и веса пишутся только в неё. */
    platform?: TypographyOverridePlatform;
    size?: number;
    lineHeight?: number;
    letterSpacing?: number;
    weights?: Partial<Record<TypographyVariant, number>>;
    fontFamily?: string;
}

/** Значение токена стиля на платформе, которое может изменить правка. */
export interface TypographyValueAddress {
    tokenId: string;
    platform: TypographyPlatform;
}

/**
 * Ответ изменения стиля: стиль на экране токена и записанные значения токенов. Технические редакции записанных
 * значений приходят в заголовке `X-DS-Mutation-Metadata`.
 */
export interface UpdatedTypographyStyle {
    style: TypographyStyle;
    tokens: Array<{ tokenId: string; name: string; values: Array<{ platform: TypographyPlatform; value: unknown }> }>;
}

/** Поле инспектора: размеры стиля, вес начертания или семейство. */
export type TypographyField = 'size' | 'lineHeight' | 'letterSpacing' | 'fontFamily' | `weights.${TypographyVariant}`;
