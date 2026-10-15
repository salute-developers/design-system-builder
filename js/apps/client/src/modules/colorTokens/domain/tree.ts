import type { ColorTokenView, TokenGroupDto } from './types';

export type TreeSort = 'az' | 'source';

export interface TreeOptions {
    query: string;
    sort: TreeSort;
    issuesOnly: boolean;
}

export const UNGROUPED_LABEL = 'Без группы';
const UNGROUPED_PREFIX = 'ungrouped:';

/** Подгруппа дерева; служебная «Без группы» собирает токены без группы с кодом этой группы. */
export interface TreeSubgroup {
    group: TokenGroupDto;
    synthetic: boolean;
    tokens: ColorTokenView[];
}

/** Группа дерева: токены прямо в группе, затем подгруппы. Служебная группа «Без группы» — в конце дерева. */
export interface TreeGroup {
    group: TokenGroupDto;
    synthetic: boolean;
    tokens: ColorTokenView[];
    subgroups: TreeSubgroup[];
}

/** Служебный узел «Без группы»: операции над ним недоступны. */
export const isSyntheticGroup = (groupId: string) => groupId.startsWith(UNGROUPED_PREFIX);

const synthetic = (parentId: string | null): TokenGroupDto => ({
    id: `${UNGROUPED_PREFIX}${parentId ?? 'root'}`,
    parentId,
    code: null,
    label: UNGROUPED_LABEL,
    position: Number.MAX_SAFE_INTEGER,
    kind: 'color',
});

const matches = (token: ColorTokenView, query: string) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [token.displayName, `${token.key.group}.${token.key.name}`].some((text) =>
        text.toLowerCase().includes(needle),
    );
};

const byPosition = (a: TokenGroupDto, b: TokenGroupDto) => a.position - b.position || a.label.localeCompare(b.label);

/** Код группы узла: свой у группы, родителя — у подгруппы. */
export const groupCode = (groups: TokenGroupDto[], groupId: string | null): string | null => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return null;
    return group.code ?? groups.find((item) => item.id === group.parentId)?.code ?? null;
};

/**
 * Дерево по хранимым группам и подгруппам: поиск по имени, фильтр проблем, сортировка «А–Я» внутри узла или
 * хранимый порядок. Без поиска и фильтра пустые группы и подгруппы видны, с ними — только узлы с найденными токенами.
 */
export const buildTree = (groups: TokenGroupDto[], views: ColorTokenView[], options: TreeOptions): TreeGroup[] => {
    const filtering = Boolean(options.query.trim()) || options.issuesOnly;
    const visible = views.filter(
        (token) => matches(token, options.query) && (!options.issuesOnly || token.issues.length),
    );
    const compare =
        options.sort === 'az'
            ? (a: ColorTokenView, b: ColorTokenView) => a.displayName.localeCompare(b.displayName)
            : (a: ColorTokenView, b: ColorTokenView) =>
                  a.position - b.position || a.displayName.localeCompare(b.displayName);
    const known = new Set(groups.map((group) => group.id));
    const ungrouped = visible.filter((token) => !token.groupId || !known.has(token.groupId));
    const tops = groups.filter((group) => group.parentId === null).sort(byPosition);
    // Токен без группы попадает в «Без группы» первой группы со своим кодом.
    const homeOf = new Map<ColorTokenView, string>();
    for (const token of ungrouped) {
        const home = tops.find((group) => group.code === token.key.group);
        if (home) homeOf.set(token, home.id);
    }
    const inGroup = (groupId: string) => visible.filter((token) => token.groupId === groupId).sort(compare);

    const tree: TreeGroup[] = tops.map((top) => {
        const subgroups: TreeSubgroup[] = groups
            .filter((group) => group.parentId === top.id)
            .sort(byPosition)
            .map((group) => ({ group, synthetic: false, tokens: inGroup(group.id) }));
        const homeless = ungrouped.filter((token) => homeOf.get(token) === top.id).sort(compare);
        if (homeless.length) subgroups.push({ group: synthetic(top.id), synthetic: true, tokens: homeless });
        return { group: top, synthetic: false, tokens: inGroup(top.id), subgroups };
    });
    const rest = ungrouped.filter((token) => !homeOf.has(token)).sort(compare);
    if (rest.length) tree.push({ group: synthetic(null), synthetic: true, tokens: rest, subgroups: [] });

    if (!filtering) return tree;
    return tree
        .map((node) => ({ ...node, subgroups: node.subgroups.filter((subgroup) => subgroup.tokens.length) }))
        .filter((node) => node.tokens.length || node.subgroups.length);
};

/** Токены узла дерева в отображаемом порядке: прямо в группе, затем по подгруппам. */
export const treeTokens = (node: TreeGroup) => [...node.tokens, ...node.subgroups.flatMap((item) => item.tokens)];
