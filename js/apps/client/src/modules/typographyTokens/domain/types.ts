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

/** Начертание стиля на экране: токен и вес. */
export interface TypographyVariantView {
    tokenId: string;
    weight: number;
}

/** Компонент, который использует стиль, и число значений свойств со ссылкой. */
export interface TypographyComponentUsage {
    name: string;
    count: number;
}

/** Стиль типографии на экране в единицах редактора. */
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
}

/** Семейство шрифта дизайн-системы. */
export interface TypographyFamily {
    name: string;
    fontName: string;
}

/** Стили темы для раздела «Типографика». */
export interface TypographyStyles {
    editRevision: number;
    canEdit: boolean;
    themeCount: number;
    families: TypographyFamily[];
    screens: Array<{ screen: TypographyScreen; styles: TypographyStyle[] }>;
}

/** Правка стиля: размеры — на экране токена, веса и семейство — на всех экранах. */
export interface TypographyStyleChange {
    size?: number;
    lineHeight?: number;
    letterSpacing?: number;
    weights?: Partial<Record<TypographyVariant, number>>;
    fontFamily?: string;
}

export type TypographyPlatform = 'web' | 'ios' | 'android';

/** Ответ изменения стиля: новая ревизия, стиль на экране токена и записанные значения токенов. */
export interface UpdatedTypographyStyle {
    editRevision: number;
    style: TypographyStyle;
    tokens: Array<{ tokenId: string; name: string; values: Array<{ platform: TypographyPlatform; value: unknown }> }>;
}

/** Поле инспектора: размеры стиля, вес начертания или семейство. */
export type TypographyField = 'size' | 'lineHeight' | 'letterSpacing' | 'fontFamily' | `weights.${TypographyVariant}`;
