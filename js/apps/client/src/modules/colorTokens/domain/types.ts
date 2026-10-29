import type { ValueKind } from './gradient';
import type { NativePlatform } from './nativeGradient';
import type { Paint } from './paint';

/** Модель экрана Color Tokens: цветовой токен экрана — семейство определений с общими группой и именем. */

export type ColorMode = 'light' | 'dark';
export type ColorContext = 'ondark' | 'onlight' | 'inverse';
export type ColorTokenType = 'color' | 'gradient';

/**
 * Ключ токена экрана: группа (`text`) и имя без подгруппы и состояния (`accent-minor`). Тип семейства в ключ не
 * входит: он следует из вида значений и меняется правкой значения.
 */
export interface ColorTokenKey {
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
    /** Исходное значение: HEX, ссылка `[type.shade.step][opacity]` или слои CSS-градиента через запятую. */
    value: string;
    /** Хранимое значение платформы. */
    raw: unknown;
    /** Цвет для отображения по палитре темы; для градиента — CSS-градиент с раскрытыми ссылками стопов. */
    resolved: string;
    /** Цвет для подписи и контраста: сам цвет или первый стоп редактируемого слоя градиента по палитре темы. */
    baseColor: string;
    /** Имя ступени палитры («Blue 500») для ссылки или `null`. */
    paletteLabel: string | null;
    /** Прозрачность 0..1. */
    opacity: number;
    /** Вид значения или `null`, если значение не цвет и не градиент. */
    kind: ValueKind | null;
    /** Цвет или градиент для выбора цвета; `null` у значения, которое выбор цвета не меняет. */
    paint: Paint | null;
    /** Имя ступени палитры, которой нет в палитре темы, или `null`. */
    missing: string | null;
    /** Свои значения iOS и Android — строки платформ под полем; у значения платформы пусто. */
    platforms: Partial<Record<NativePlatform, ColorFieldValue>>;
}

export interface ColorValueIssue {
    /** `light`, `dark` или `<context>-<mode>`. */
    field: string;
    message: string;
}

export interface ColorTokenView {
    key: ColorTokenKey;
    /** Ключ строки дерева: `text.accent`. */
    id: string;
    /** Тип семейства на сервере: `gradient`, если хотя бы одно значение где-либо — градиент. */
    type: ColorTokenType;
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
    editRevision?: number;
}

/** Место определения в группах и признак публикации. */
export interface TokenPlacement {
    groupId: string | null;
    position: number;
    /** Последняя опубликованная версия, в которую попало определение. */
    publishedIn: string | null;
}
