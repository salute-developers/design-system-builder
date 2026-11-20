import { canonicalStateName } from '../controllers/componentBuilder/stateSupport';
import type { StateSupport } from '../controllers/componentBuilder/type';
import type { ComponentPropertyDto, ComponentStateDto } from './editorContracts';

/**
 * Состояние по имени в пределах компонента — то же правило, что у `ds-service`: сначала общее, затем собственное
 * состояние компонента. Состояния других компонентов не рассматриваются, поэтому `checked` у `CheckBox` не возьмёт
 * идентификатор `checked` компонента `RadioBox`.
 */
export const resolveStateId = (
    name: string,
    componentId: string,
    states: readonly ComponentStateDto[],
): string | undefined => {
    const key = canonicalStateName(name);
    const matching = states.filter((state) => canonicalStateName(state.name) === key);
    return (
        matching.find((state) => !state.componentId)?.id ??
        matching.find((state) => state.componentId === componentId)?.id
    );
};

/**
 * Признак свойства для редактора: идентификаторы признака заменяются именами из состояний бандла. `null` —
 * признак не задан; `undefined` — сервер или путь чтения его не отдаёт (действует прежнее правило).
 */
export const stateSupportOf = (
    property: ComponentPropertyDto,
    states: readonly ComponentStateDto[] | undefined,
): StateSupport | null | undefined => {
    if (!states || property.stateSupport === undefined) return undefined;
    if (property.stateSupport === null) return null;
    const names = new Map(states.map((state) => [state.id, state.name]));
    return {
        states: property.stateSupport.stateIds.flatMap((id) => names.get(id) ?? []),
        combinations: property.stateSupport.combinations,
    };
};
