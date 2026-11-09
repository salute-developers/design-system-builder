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
 * Дочерние ветки: значения всех вариаций после `axisIndex`. В корне (`axisIndex = -1`) — значения всех вариаций.
 * Так каждое сочетание встречается в дереве ровно один раз, в том числе сочетание без первой вариации.
 */
export const treeChildren = (
    axes: EditorAxisDto[],
    parent?: Pick<VariationTreeBranch, 'key' | 'styleIds' | 'axisIndex'>,
): VariationTreeBranch[] =>
    axes.slice((parent?.axisIndex ?? -1) + 1).flatMap((axis, offset) =>
        [...axis.values]
            .sort((a, b) => a.position - b.position)
            .map((value) => ({
                key: `${parent?.key ?? ''}/${value.styleId}`,
                axis,
                value,
                styleIds: [...(parent?.styleIds ?? []), value.styleId],
                axisIndex: (parent?.axisIndex ?? -1) + 1 + offset,
            })),
    );

/**
 * Настроенные сочетания под веткой или в ней самой: сочетание `combination` лежит в поддереве ветки, если содержит
 * все её стили, а из вариаций до вариации ветки — только их.
 */
export const configuredWithin = (
    axes: EditorAxisDto[],
    branch: Pick<VariationTreeBranch, 'styleIds' | 'axisIndex'>,
    combinations: readonly string[][],
) => {
    const earlier = new Set(axes.slice(0, branch.axisIndex + 1).flatMap((axis) => axis.values.map((v) => v.styleId)));
    return combinations.filter(
        (combination) =>
            branch.styleIds.every((id) => combination.includes(id)) &&
            combination.filter((id) => earlier.has(id)).length === branch.styleIds.length,
    );
};

export const isConfigured = (styleIds: readonly string[], combinations: readonly string[][]) =>
    styleIds.length > 1 && combinations.some((combination) => sameStyles(combination, styleIds));

/** Подпись сочетания: `size: l · shape: pilled`. */
export const branchPathLabel = (axes: EditorAxisDto[], styleIds: readonly string[]) =>
    styleIds
        .map((id) => {
            const axis = axes.find((item) => item.values.some((value) => value.styleId === id));
            const value = axis?.values.find((item) => item.styleId === id);
            return axis && value ? `${axis.name}: ${value.name}` : id;
        })
        .join(' · ');
