/** Модель экрана Color Tokens: цветовой токен экрана — семейство определений с общими группой и именем. */

export type ColorMode = 'light' | 'dark';
export type ColorContext = 'ondark' | 'onlight' | 'inverse';
export type ColorTokenType = 'color' | 'gradient';

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
    /** Группа или подгруппа токенов; `null` — токен без группы. */
    groupId: string | null;
    /** Позиция в группе или подгруппе. */
    position: number;
    /** Последняя опубликованная версия с этим токеном или `null`. */
    publishedIn: string | null;
    enabled: boolean;
    incomplete: boolean;
    modes: Record<ColorMode, ColorFieldValue>;
    contexts: Record<ColorContext, { linked: boolean; values: Record<ColorMode, ColorFieldValue> }>;
    issues: ColorValueIssue[];
}

/** Группа (`parentId === null`, есть `code`) или подгруппа токенов дизайн-системы. */
export interface TokenGroupDto {
    id: string;
    parentId: string | null;
    /** Первый сегмент имени токенов группы; у подгруппы `null`. */
    code: string | null;
    label: string;
    position: number;
    kind: 'color';
}

/** Место определения в группах и признак публикации. */
export interface TokenPlacement {
    groupId: string | null;
    position: number;
    /** Последняя опубликованная версия, в которую попало определение. */
    publishedIn: string | null;
}
