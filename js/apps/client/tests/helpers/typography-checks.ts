import { expect } from '@playwright/test';
import type { TokenValue } from './token-values.api.ts';

/** Сравнить только ожидаемые поля изменённых токенов; остальные значения и ревизии должны совпасть. */
export function expectTypographyPatch(
    before: readonly TokenValue[],
    after: readonly TokenValue[],
    tokenIds: readonly string[],
    patches: Partial<Record<TokenValue['platform'], Readonly<Record<string, unknown>>>>,
): void {
    const selected = new Set(tokenIds);
    expect(after).toHaveLength(before.length);
    expect(after.filter((value) => !selected.has(value.tokenId))).toEqual(
        before.filter((value) => !selected.has(value.tokenId)),
    );
    const targeted = before.filter((value) => selected.has(value.tokenId));
    expect(targeted).toHaveLength(tokenIds.length * 3);
    for (const value of targeted) {
        const matches = after.filter(
            (item) => item.tokenId === value.tokenId && item.platform === value.platform && item.mode === value.mode,
        );
        expect(matches).toHaveLength(1);
        const current = matches[0]!;
        const patch = patches[value.platform];
        if (!patch) {
            expect(current).toEqual(value);
            continue;
        }
        expect(Array.isArray(value.value)).toBe(true);
        expect(current.value).toEqual((value.value as object[]).map((item) => ({ ...item, ...patch })));
        expect(current.editRevision).toBeGreaterThan(value.editRevision);
    }
}
