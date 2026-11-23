import type { Combination, Config } from './config';
import type { PropUnion } from './type';
import type { Style } from './style';
import type { Variation } from './variation';

const COLOR_SCHEME = 'view';

/** Вариация — цветовая схема: `view` по имени каталога, переименование в конфигурации не меняет роль. */
export const isColorSchemeVariation = (config: Config, variation: Variation) =>
    (config.getCatalogVariationNames().get(variation.getID()) ?? variation.getName()).toLowerCase() === COLOR_SCHEME;

/**
 * Порядок вариаций как у уровней дерева «Структуры»: вариации в порядке модели, цветовая схема последней. Он же —
 * приоритет значений: стиль вариации ниже в дереве перекрывает значения вышестоящих.
 */
export const variationOrder = (config: Config): Variation[] => {
    const variations = config.getVariations();
    return [
        ...variations.filter((variation) => !isColorSchemeVariation(config, variation)),
        ...variations.filter((variation) => isColorSchemeVariation(config, variation)),
    ];
};

/** Откуда пришло действующее значение: стиль вариации или пересечение стилей. */
export type SelectedPropOrigin =
    | { kind: 'style'; variation: Variation; style: Style }
    | { kind: 'combination'; combination: Combination };

export interface SelectedProp {
    prop: PropUnion;
    from: SelectedPropOrigin;
}

/**
 * Действующие значения при выбранных стилях: значения стилей в порядке дерева (`variationOrder`), поверх них —
 * пересечения, все стили которых выбраны, от меньших к большим. Более позднее базовое значение и каждый набор состояний перекрывают ранние независимо.
 */
export const resolveSelectedProps = (config: Config, styleIDs: Iterable<string>): Map<string, SelectedProp> => {
    const selected = new Set(styleIDs);
    const byID = new Map<string, SelectedProp>();
    const apply = (prop: PropUnion, from: SelectedPropOrigin) => {
        const previous = byID.get(prop.getID());
        byID.set(prop.getID(), {
            prop: previous
                ? previous.prop.overlay(prop)
                : from.kind === 'combination' && prop.getValue() === undefined
                  ? (config.getInvariants().getProp(prop.getID())?.overlay(prop) ?? prop)
                  : prop,
            from: prop.getValue() === undefined && previous ? previous.from : from,
        });
    };
    for (const variation of variationOrder(config)) {
        const style = variation.getStyles()?.find((item) => selected.has(item.getID()));
        style
            ?.getProps()
            ?.getList()
            .forEach((prop) => apply(prop, { kind: 'style', variation, style }));
    }
    config
        .getCombinations()
        .filter(({ styleIDs: ids }) => ids.length > 0 && ids.every((id) => selected.has(id)))
        .sort((a, b) => a.styleIDs.length - b.styleIDs.length)
        .forEach((combination) =>
            combination.props.getList().forEach((prop) => apply(prop, { kind: 'combination', combination })),
        );
    return byID;
};
