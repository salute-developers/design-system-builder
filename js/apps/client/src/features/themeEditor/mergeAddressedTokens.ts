import type { ThemeEditorSnapshot, ThemeEditorTokenSnapshot } from '../../api/editorContracts';

/** Заменяет выбранные цвета/градиенты и их адреса; IDs уже проверены адресным чтением раздела. */
export function mergeAddressedTokens(
    previous: ThemeEditorSnapshot,
    next: ThemeEditorTokenSnapshot,
    ids: Set<string>,
): ThemeEditorSnapshot {
    const definitions = Object.values(previous.tokenDefinitionsByName ?? {});
    const removed = new Map<string, Set<string>>();
    for (const token of definitions.filter((item) => ids.has(item.id))) {
        const names = removed.get(token.type) ?? new Set<string>();
        names.add(`light.${token.name}`);
        names.add(`dark.${token.name}`);
        removed.set(token.type, names);
    }
    const retained = definitions.filter((token) => !ids.has(token.id));
    const merged = [...retained, ...Object.values(next.tokenDefinitionsByName ?? {})];
    const keepName = (type: string, name: string) => !removed.get(type)?.has(name);
    const variations = structuredClone(previous.themeData.variations);
    for (const type of Object.keys(variations) as (keyof typeof variations)[]) {
        const platforms = variations[type];
        for (const platform of Object.keys(platforms) as (keyof typeof platforms)[]) {
            platforms[platform] = {
                ...Object.fromEntries(Object.entries(platforms[platform]).filter(([name]) => keepName(type, name))),
                ...next.themeData.variations[type][platform],
            };
        }
    }
    const addresses = <T>(before: Record<string, T>, after: Record<string, T>) => ({
        ...Object.fromEntries(Object.entries(before).filter(([key]) => !ids.has(key.split(':')[0]))),
        ...after,
    });
    return {
        ...previous,
        themeData: {
            meta: {
                ...previous.themeData.meta,
                tokens: [
                    ...previous.themeData.meta.tokens.filter((token) => keepName(token.type, token.name)),
                    ...next.themeData.meta.tokens,
                ],
            },
            variations,
        },
        tokenDefinitionsByName: Object.fromEntries(merged.map((token) => [token.name, token])),
        tokenIdsByName: Object.fromEntries(merged.map((token) => [token.name, token.id])),
        incompleteTokenIds: [...previous.incompleteTokenIds.filter((id) => !ids.has(id)), ...next.incompleteTokenIds],
        tokenValueRevisionsByKey: addresses(previous.tokenValueRevisionsByKey, next.tokenValueRevisionsByKey),
        tokenValueEntityIdsByKey: addresses(
            previous.tokenValueEntityIdsByKey ?? {},
            next.tokenValueEntityIdsByKey ?? {},
        ),
        tokenValueOverriddenByKey: addresses(
            previous.tokenValueOverriddenByKey ?? {},
            next.tokenValueOverriddenByKey ?? {},
        ),
    };
}
