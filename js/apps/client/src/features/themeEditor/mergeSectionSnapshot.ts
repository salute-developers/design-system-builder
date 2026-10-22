import type { ThemeEditorSnapshot, ThemeEditorTokenSnapshot, TokenDefinitionDto } from '../../api/editorContracts';

/** Заменяет только типы прочитанного раздела, сохраняя данные и редакции остальных разделов. */
export function mergeSectionTokens(
    previous: ThemeEditorSnapshot,
    next: ThemeEditorTokenSnapshot,
    types: TokenDefinitionDto['type'][],
): ThemeEditorSnapshot {
    const retained = Object.values(previous.tokenDefinitionsByName ?? {}).filter(
        (token) => !types.includes(token.type),
    );
    const definitions = [...retained, ...Object.values(next.tokenDefinitionsByName ?? {})];
    const retainedIds = new Set(retained.map((token) => token.id));
    const retainAddresses = <T>(addresses: Record<string, T>) =>
        Object.fromEntries(Object.entries(addresses).filter(([key]) => retainedIds.has(key.split(':')[0])));
    return {
        ...previous,
        ...next,
        themeData: {
            meta: {
                ...previous.themeData.meta,
                ...next.themeData.meta,
                tokens: [
                    ...previous.themeData.meta.tokens.filter((token) => !types.includes(token.type)),
                    ...next.themeData.meta.tokens,
                ],
            },
            variations: {
                ...previous.themeData.variations,
                ...Object.fromEntries(types.map((type) => [type, next.themeData.variations[type]])),
            },
        },
        palette: next.palette ?? previous.palette,
        paletteError: types.some((type) => ['color', 'gradient', 'shadow'].includes(type))
            ? next.paletteError
            : previous.paletteError,
        incompleteTokenIds: [
            ...previous.incompleteTokenIds.filter((id) => retainedIds.has(id)),
            ...next.incompleteTokenIds,
        ],
        tokenDefinitionsByName: Object.fromEntries(definitions.map((token) => [token.name, token])),
        tokenIdsByName: Object.fromEntries(definitions.map((token) => [token.name, token.id])),
        tokenValueRevisionsByKey: {
            ...retainAddresses(previous.tokenValueRevisionsByKey),
            ...next.tokenValueRevisionsByKey,
        },
        tokenValueEntityIdsByKey: {
            ...retainAddresses(previous.tokenValueEntityIdsByKey ?? {}),
            ...next.tokenValueEntityIdsByKey,
        },
    };
}
