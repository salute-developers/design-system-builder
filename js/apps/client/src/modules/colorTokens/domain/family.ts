import type { ColorContext, ColorMode, ColorState, ColorTokenKey, ParsedMemberName } from './types';

export const COLOR_MODES: readonly ColorMode[] = ['light', 'dark'];
export const COLOR_CONTEXTS: readonly ColorContext[] = ['ondark', 'onlight', 'inverse'];
export const COLOR_STATES: readonly ColorState[] = ['hover', 'active', 'brightness'];

/** Состояния, которые редактор создаёт у нового токена; `-brightness` есть только у части токенов сидов. */
export const CREATED_STATES: readonly ColorState[] = ['hover', 'active'];

/** Группы, у которых редактор пересчитывает состояния `-hover` и `-active`. */
export const STATEFUL_GROUPS = new Set(['text', 'surface', 'outline', 'data']);

const MODES = new Set<string>(COLOR_MODES);

/** Подгруппа определения для подтемы: у `background` подтемы называются `dark` и `light`. */
export const contextSubgroup = (group: string, context: ColorContext) => {
    if (context === 'inverse') return 'inverse';
    if (group === 'background') return context === 'ondark' ? 'dark' : 'light';
    return context === 'ondark' ? 'on-dark' : 'on-light';
};

/** Подтема по подгруппе определения или `null` для `default`. */
export const contextOfSubgroup = (subgroup: string): ColorContext | null => {
    if (subgroup === 'inverse') return 'inverse';
    if (subgroup === 'on-dark' || subgroup === 'dark') return 'ondark';
    if (subgroup === 'on-light' || subgroup === 'light') return 'onlight';
    return null;
};

/** Подгруппы семейства: `default` и три подтемы. */
export const familySubgroups = (group: string) => [
    'default',
    ...COLOR_CONTEXTS.map((it) => contextSubgroup(group, it)),
];

/** Разбирает имя определения темы; `null`, если имя не из трёх сегментов после режима. */
export const parseMemberName = (fullName: string): ParsedMemberName | null => {
    const segments = fullName.split('.');
    const mode = MODES.has(segments[0]) ? (segments.shift() as ColorMode) : null;
    if (segments.length !== 3) return null;
    const [group, subgroup, member] = segments;
    const state = COLOR_STATES.find((it) => member.endsWith(`-${it}`)) ?? null;
    const name = state ? member.slice(0, -(state.length + 1)) : member;
    return { mode, group, subgroup, name, state };
};

/** Ключ строки дерева. */
export const tokenId = (key: ColorTokenKey) => `${key.type}:${key.group}.${key.name}`;

/** Имя определения без режима: `text.on-dark.accent-hover`. */
export const memberName = (key: ColorTokenKey, subgroup: string, state: ColorState | null = null) =>
    `${key.group}.${subgroup}.${key.name}${state ? `-${state}` : ''}`;

/** Имя определения в теме: с префиксом режима. */
export const themeMemberName = (
    key: ColorTokenKey,
    mode: ColorMode,
    subgroup: string,
    state: ColorState | null = null,
) => `${mode}.${memberName(key, subgroup, state)}`;

/**
 * Режим значения по умолчанию, от которого наследуется подтема: OnDark — Dark, OnLight — Light, Inverse меняет
 * режимы местами.
 */
export const inheritedMode = (context: ColorContext, mode: ColorMode): ColorMode => {
    if (context === 'ondark') return 'dark';
    if (context === 'onlight') return 'light';
    return mode === 'dark' ? 'light' : 'dark';
};

/** Поля подтем, связанные со значением режима по умолчанию: правка Light меняет их вслед. */
export const fieldsInheritingFrom = (mode: ColorMode): Array<{ context: ColorContext; mode: ColorMode }> =>
    COLOR_CONTEXTS.flatMap((context) =>
        COLOR_MODES.filter((target) => inheritedMode(context, target) === mode).map((target) => ({
            context,
            mode: target,
        })),
    );
