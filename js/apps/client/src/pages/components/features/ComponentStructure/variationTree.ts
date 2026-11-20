import type { EditorAxisDto, EditorAxisValueDto } from '../../../../api/editorContracts';

/** Ветка дерева вариаций: значение вариации под путём родителя. Путь из двух и больше значений — пересечение. */
export interface VariationTreeBranch {
    /** Ключ раскрытия: стили пути через `/`. */
    key: string;
    axis: EditorAxisDto;
    value: EditorAxisValueDto;
    /** Стили пути от корня до ветки включительно. */
    styleIds: string[];
    /** Порядковый номер вариации ветки в дереве: дочерние ветки берутся из вариаций после неё. */
    axisIndex: number;
}

export const sameStyles = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id) => b.includes(id));

/** Уровни дерева: вариации в порядке конфигурации, цветовая схема последней. */
export const treeAxes = (axes: EditorAxisDto[]) =>
    [...axes].sort((a, b) => Number(a.isColorScheme) - Number(b.isColorScheme) || a.position - b.position);

/**
 * Дочерние ветки: значения вариации следующего уровня. В корне (`axisIndex = -1`) — значения первой вариации; уровни
 * идут подряд, поэтому цветовая схема (последняя) встречается только в листьях.
 */
export const treeChildren = (
    axes: EditorAxisDto[],
    parent?: Pick<VariationTreeBranch, 'key' | 'styleIds' | 'axisIndex'>,
): VariationTreeBranch[] => {
    const axisIndex = (parent?.axisIndex ?? -1) + 1;
    const axis = axes[axisIndex];
    if (!axis) return [];
    return [...axis.values]
        .sort((a, b) => a.position - b.position)
        .map((value) => ({
            key: `${parent?.key ?? ''}/${value.styleId}`,
            axis,
            value,
            styleIds: [...(parent?.styleIds ?? []), value.styleId],
            axisIndex,
        }));
};

/** Сочетание — путь от корня: по одному стилю первых `n` уровней подряд, без пропусков. */
export const isTreePath = (axes: EditorAxisDto[], combination: readonly string[]) =>
    combination.length > 0 &&
    axes
        .slice(0, combination.length)
        .every((axis) => axis.values.filter((value) => combination.includes(value.styleId)).length === 1);

/** Настроенные пересечения-пути в ветке или под ней: путь начинается со стилей ветки. */
export const configuredWithin = (
    axes: EditorAxisDto[],
    branch: Pick<VariationTreeBranch, 'styleIds'>,
    combinations: readonly string[][],
) =>
    combinations.filter(
        (combination) =>
            combination.length >= branch.styleIds.length &&
            isTreePath(axes, combination) &&
            branch.styleIds.every((id) => combination.includes(id)),
    );

/** Настроенные пересечения, которые пропускают уровень: в дереве их нет, они показываются отдельным списком. */
export const offTreeCombinations = (axes: EditorAxisDto[], combinations: readonly string[][]) =>
    combinations.filter((combination) => !isTreePath(axes, combination));

export const isConfigured = (styleIds: readonly string[], combinations: readonly string[][]) =>
    styleIds.length > 1 && combinations.some((combination) => sameStyles(combination, styleIds));

/** Подпись сочетания в порядке уровней дерева: `size: l · shape: pilled`. */
export const branchPathLabel = (axes: EditorAxisDto[], styleIds: readonly string[]) =>
    axes
        .flatMap((axis) =>
            axis.values
                .filter((value) => styleIds.includes(value.styleId))
                .map((value) => `${axis.name}: ${value.name}`),
        )
        .join(' · ');
