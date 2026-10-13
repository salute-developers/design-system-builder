/** Модель экрана Color Tokens: цветовой токен экрана — семейство определений с общими группой и именем. */

export type ColorMode = 'light' | 'dark';
export type ColorContext = 'ondark' | 'onlight' | 'inverse';
export type ColorTokenType = 'color' | 'gradient';

/** Разделы дерева в порядке прототипа. */
export type ColorSection = 'text' | 'surface' | 'outline' | 'background' | 'overlay' | 'data' | 'technical';

/** Ключ токена экрана: тип, группа (`text`) и имя без подгруппы и состояния (`accent-minor`). */
export interface ColorTokenKey {
    type: ColorTokenType;
    group: string;
    name: string;
}

/** Состояния, которые хранятся отдельными определениями и пересчитываются от значения. */
export type ColorState = 'hover' | 'active' | 'brightness';

/** Разобранное полное имя определения темы: `dark.text.on-dark.accent-hover`. */
export interface ParsedMemberName {
    mode: ColorMode | null;
    group: string;
    subgroup: string;
    name: string;
    state: ColorState | null;
}

export interface ColorFieldValue {
    /** Исходное значение: HEX, ссылка `[type.shade.step][opacity]` или CSS-градиент. */
    value: string;
    /** Цвет для отображения по палитре темы; для градиента — CSS-градиент. */
    resolved: string;
    /** Имя ступени палитры («Blue 500») для ссылки или `null`. */
    paletteLabel: string | null;
    /** Прозрачность 0..1. */
    opacity: number;
}

export interface ColorValueIssue {
    /** `light`, `dark` или `<context>-<mode>`. */
    field: string;
    message: string;
}

export interface ColorTokenView {
    key: ColorTokenKey;
    /** Ключ строки дерева: `color:text.accent`. */
    id: string;
    displayName: string;
    description: string;
    section: ColorSection;
    category: string;
    paletteGroupId: string | null;
    sourceIndex: number;
    enabled: boolean;
    incomplete: boolean;
    modes: Record<ColorMode, ColorFieldValue>;
    contexts: Record<ColorContext, { linked: boolean; values: Record<ColorMode, ColorFieldValue> }>;
    issues: ColorValueIssue[];
}
