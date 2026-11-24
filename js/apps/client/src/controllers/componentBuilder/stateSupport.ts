import type { ComponentAPI, PropState } from './type';

/** Состояния взаимодействия идут в меню и подписях первыми, в этом порядке; остальные — в порядке признака. */
export const PRIMARY_STATES: readonly PropState[] = ['focused', 'pressed', 'hovered'];

/** Прежнее правило для свойства без признака: только цвет без `focus` в имени и только эти состояния. */
const LEGACY_STATES: readonly PropState[] = PRIMARY_STATES;

/** Порядок меню: сначала [PRIMARY_STATES], затем остальные в исходном порядке. */
export const orderStates = (states: readonly PropState[]): PropState[] => [
    ...PRIMARY_STATES.filter((state) => states.includes(state)),
    ...states.filter((state) => !PRIMARY_STATES.includes(state)),
];

/** Имя без регистра и разделителей, как сравнивает `ds-service`. */
export const canonicalStateName = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

type StateApi = Pick<ComponentAPI, 'name' | 'type' | 'stateSupport'> | undefined;

/**
 * Состояния, которые меню «Добавить состояние» предлагает свойству; пустой список — кнопки нет. Заданный признак предлагает ровно свои состояния; без признака действует прежнее правило.
 */
export const bindableStates = (api: StateApi, _isCombination: boolean): PropState[] => {
    if (!api) return [];
    if (api.stateSupport) return orderStates(api.stateSupport.states);
    return api.type === 'color' && !/focus/i.test(api.name) ? [...LEGACY_STATES] : [];
};

/** Можно ли отметить в меню сразу несколько состояний; без признака сочетания разрешены, как раньше. */
export const allowsCombinations = (api: StateApi) => api?.stateSupport?.combinations ?? true;

/**
 * Допустим ли записанный набор состояний по признаку свойства. Недопустимую строку редактор показывает только для
 * чтения: сервер отклонит её правку (`states_not_supported`), но удалить её можно.
 */
export const isStateSetAllowed = (api: StateApi, state: readonly PropState[]) => {
    const support = api?.stateSupport;
    if (!support) return true;
    if (state.length > 1 && !support.combinations) return false;
    const allowed = new Set(support.states.map(canonicalStateName));
    return state.every((item) => allowed.has(canonicalStateName(item)));
};
