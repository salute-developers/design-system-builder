import { SECTION_ORDER } from './sections';
import type { ColorSection, ColorTokenView } from './types';

export type TreeSort = 'az' | 'source';

export interface TreeOptions {
    query: string;
    sort: TreeSort;
    issuesOnly: boolean;
}

export interface TreeSection {
    section: ColorSection;
    tokens: ColorTokenView[];
}

const matches = (token: ColorTokenView, query: string) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [token.displayName, `${token.key.group}.${token.key.name}`].some((text) =>
        text.toLowerCase().includes(needle),
    );
};

/** Дерево разделов: поиск по имени, фильтр проблем, сортировка «А–Я» или «Исходные»; пустые разделы не выводятся. */
export const buildTree = (views: ColorTokenView[], options: TreeOptions): TreeSection[] => {
    const visible = views.filter(
        (token) => matches(token, options.query) && (!options.issuesOnly || token.issues.length),
    );
    const compare =
        options.sort === 'az'
            ? (a: ColorTokenView, b: ColorTokenView) => a.displayName.localeCompare(b.displayName)
            : (a: ColorTokenView, b: ColorTokenView) => a.sourceIndex - b.sourceIndex;
    return SECTION_ORDER.map((section) => ({
        section,
        tokens: visible.filter((token) => token.section === section).sort(compare),
    })).filter((group) => group.tokens.length > 0);
};

/** Категории раздела на борде в порядке первого появления токена. */
export const boardCategories = (tokens: ColorTokenView[]) => {
    const categories = new Map<string, ColorTokenView[]>();
    for (const token of [...tokens].sort((a, b) => a.sourceIndex - b.sourceIndex)) {
        categories.set(token.category, [...(categories.get(token.category) ?? []), token]);
    }
    return [...categories.entries()].map(([category, items]) => ({ category, tokens: items }));
};
