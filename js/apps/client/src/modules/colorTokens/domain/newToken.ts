import {
    CREATED_STATES,
    COLOR_CONTEXTS,
    COLOR_MODES,
    STATEFUL_GROUPS,
    contextSubgroup,
    inheritedMode,
    memberName,
} from './family';
import { isHexColor } from './validation';
import { sectionGroup } from './sections';
import type { ColorMode, ColorSection, ColorState, ColorTokenKey } from './types';

export const NEW_TOKEN_MESSAGES = {
    name: 'Введите имя токена: латиница и цифры.',
    state: 'Имя токена не может оканчиваться на -hover, -active или -brightness.',
    exists: (displayName: string) => `Токен ${displayName} уже есть в теме.`,
    hex: 'Значения Light и Dark должны быть цветом в формате Hex.',
} as const;

export interface NewColorTokenInput {
    section: ColorSection;
    /** Solid или Transparent для Surfaces и Outlines. */
    surfaceKind: 'Solid' | 'Transparent' | null;
    name: string;
    light: string;
    dark: string;
}

const words = (value: string) =>
    value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((word) => word.toLowerCase());

const pascal = (parts: string[]) => parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');

/** Ключ и отображаемое имя нового токена по вводу пользователя или текст ошибки. */
export const normalizeNewToken = (
    input: NewColorTokenInput,
    existing: ReadonlySet<string>,
): { key: ColorTokenKey; displayName: string } | { error: string } => {
    const parts = words(input.name);
    if (!parts.length) return { error: NEW_TOKEN_MESSAGES.name };
    const transparent = input.surfaceKind === 'Transparent' && parts[0] !== 'transparent';
    const nameParts = transparent ? ['transparent', ...parts] : parts;
    const name = nameParts.join('-');
    if (/-(hover|active|brightness)$/.test(name)) return { error: NEW_TOKEN_MESSAGES.state };
    const group = sectionGroup(input.section);
    const key: ColorTokenKey = { type: 'color', group, name };
    const displayName = `${group}${pascal(nameParts)}`;
    if (existing.has(`${group}.${name}`)) return { error: NEW_TOKEN_MESSAGES.exists(displayName) };
    if (!isHexColor(input.light) || !isHexColor(input.dark)) return { error: NEW_TOKEN_MESSAGES.hex };
    return { key, displayName };
};

/** Значение состояния `-hover` или `-active` для режима — расчёт редактора (`getStateColor`). */
export type StateValue = (value: string, group: string, subgroup: string, mode: ColorMode, state: ColorState) => string;

export interface NewMemberValues {
    name: string;
    values: Array<{ mode: ColorMode; value: string }>;
}

/**
 * Определения нового токена: значения Light и Dark, подтемы с унаследованными значениями и состояния `-hover` и
 * `-active` для групп, у которых редактор их пересчитывает.
 */
export const newTokenMembers = (
    key: ColorTokenKey,
    defaults: Record<ColorMode, string>,
    stateValue: StateValue,
): NewMemberValues[] => {
    const subgroups = [
        { subgroup: 'default', value: (mode: ColorMode) => defaults[mode] },
        ...COLOR_CONTEXTS.map((context) => ({
            subgroup: contextSubgroup(key.group, context),
            value: (mode: ColorMode) => defaults[inheritedMode(context, mode)],
        })),
    ];
    const states: Array<ColorState | null> = STATEFUL_GROUPS.has(key.group) ? [null, ...CREATED_STATES] : [null];
    return subgroups.flatMap(({ subgroup, value }) =>
        states.map((state) => ({
            name: memberName(key, subgroup, state),
            values: COLOR_MODES.map((mode) => ({
                mode,
                value: state ? stateValue(value(mode), key.group, subgroup, mode, state) : value(mode),
            })),
        })),
    );
};
