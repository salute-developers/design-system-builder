import {
    CREATED_STATES,
    COLOR_CONTEXTS,
    COLOR_MODES,
    STATEFUL_GROUPS,
    contextSubgroup,
    inheritedMode,
    memberName,
} from './family';
import type { ColorMode, ColorState, ColorTokenKey } from './types';

export const NEW_TOKEN_MESSAGES = {
    name: 'Введите имя: латиница и цифры.',
    state: 'Имя не может оканчиваться на -hover, -active или -brightness.',
    exists: (name: string) => `Имя ${name} уже занято.`,
} as const;

const words = (value: string) =>
    value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((word) => word.toLowerCase());

/**
 * Имя токена (сегмент без группы и состояния) из ввода в строке дерева: «Brand Hover 2» → `brand-hover-2`.
 * [taken] — имена `<группа>.<имя>` токенов дизайн-системы.
 */
export const tokenNameFromLabel = (
    label: string,
    group: string,
    taken: ReadonlySet<string>,
): { name: string } | { error: string } => {
    const name = words(label).join('-');
    if (!name) return { error: NEW_TOKEN_MESSAGES.name };
    if (/-(hover|active|brightness)$/.test(name)) return { error: NEW_TOKEN_MESSAGES.state };
    if (taken.has(`${group}.${name}`)) return { error: NEW_TOKEN_MESSAGES.exists(name) };
    return { name };
};

/** Отображаемое имя по правилу сида: `text` + `brand-minor` → `textBrandMinor`. */
export const camelTokenName = (key: Pick<ColorTokenKey, 'group' | 'name'>) =>
    key.group +
    key.name
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');

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
