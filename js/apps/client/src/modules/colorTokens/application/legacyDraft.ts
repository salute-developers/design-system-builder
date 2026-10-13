import { parseMemberName, tokenId, type ColorTokenKey, type ColorTokenType } from '../domain';

/** Семейства токенов, у которых в прежнем черновике есть записи цвета или градиента. */
export const legacyDraftFamilies = (entries: ReadonlyArray<{ name: string; type: string }>): ColorTokenKey[] => {
    const families = new Map<string, ColorTokenKey>();
    for (const entry of entries) {
        const parsed = parseMemberName(entry.name);
        if (!parsed || (entry.type !== 'color' && entry.type !== 'gradient')) continue;
        const key: ColorTokenKey = { type: entry.type as ColorTokenType, group: parsed.group, name: parsed.name };
        families.set(tokenId(key), key);
    }
    return [...families.values()];
};
