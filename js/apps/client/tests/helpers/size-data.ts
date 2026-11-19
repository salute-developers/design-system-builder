import { expect } from '@playwright/test';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';
import { exactDefinition } from './color-data.ts';
import type { TokenDefinition, TokenValue, TokenValuesApi } from './token-values.api.ts';

const sizeTypes = 'shape,spacing,shadow';
const shadowLayer = { offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: '#00000029' } as const;

type SizeTokens = Readonly<{
    m: TokenDefinition;
    l: TokenDefinition;
    circle: TokenDefinition;
    spacing: TokenDefinition;
    shadow: TokenDefinition;
}>;

type SavedValue = Pick<TokenValue, 'tokenId' | 'platform' | 'mode' | 'value' | 'editRevision' | 'overridden'>;
export type SizeData = SizeTokens & Readonly<{ baseline: readonly SavedValue[] }>;

type SizeView = {
    radii: { tokenId: string; valuePx: number | null; fullRounding: boolean; platforms: object }[];
    spacing: { tokenId: string; valuePx: number; platforms: object }[];
    shadows: { tokenId: string; layers: unknown[]; platforms: object }[];
};

/** Только пять токенов RSS-BASE, включая редакции: независимый Owner GET после UI. */
export async function readSizeValues(api: TokenValuesApi, themeId: string, tokens: SizeTokens): Promise<SavedValue[]> {
    const ids = new Set(Object.values(tokens).map((token) => token.id));
    const selected = (await api.values(themeId, sizeTypes)).filter((value) => ids.has(value.tokenId));
    expect(selected).toHaveLength(15);
    for (const token of Object.values(tokens)) {
        const rows = selected.filter((value) => value.tokenId === token.id);
        expect(rows.map((value) => value.platform).sort()).toEqual(['android', 'ios', 'web']);
        for (const row of rows) {
            expect(row.mode).toBeNull();
            expect(row.overridden, 'Нет своих платформенных значений').toBe(false);
        }
    }
    return selected
        .map(({ tokenId, platform, mode, value, editRevision, overridden }) => ({
            tokenId,
            platform,
            mode,
            value,
            editRevision,
            overridden,
        }))
        .sort((a, b) => (a.tokenId + a.platform).localeCompare(b.tokenId + b.platform));
}

/** Независимый RSS-BASE в собственной Theme A; не использует CT-BASE и дефолтную тень T750. */
export async function prepareSizeData(api: TokenValuesApi, themeId: string, owner: Session): Promise<SizeData> {
    const definitions = await api.definitions();
    const tokens: SizeTokens = {
        m: exactDefinition(definitions, 'round.m'),
        l: exactDefinition(definitions, 'round.l'),
        circle: exactDefinition(definitions, 'round.circle'),
        spacing: exactDefinition(definitions, 'spacing.4x'),
        shadow: exactDefinition(definitions, 'down.hard.m'),
    };
    const current = await readSizeValues(api, themeId, tokens);
    const baseRevisions = (token: TokenDefinition) =>
        Object.fromEntries(
            current.filter((value) => value.tokenId === token.id).map((value) => [value.platform, value.editRevision]),
        );
    for (const [token, valuePx] of [
        [tokens.m, 8],
        [tokens.l, 16],
        [tokens.spacing, 8],
    ] as const) {
        const response = await authenticatedRequest(owner, api.sizeURL(themeId, token.id), 'PUT', [200], {
            valuePx,
            platforms: {},
            baseRevisions: baseRevisions(token),
        });
        await response.arrayBuffer();
    }
    const response = await authenticatedRequest(owner, api.sizeURL(themeId, tokens.shadow.id), 'PUT', [200], {
        layers: [shadowLayer],
        fallbackElevation: 0,
        platforms: {},
        baseRevisions: baseRevisions(tokens.shadow),
    });
    await response.arrayBuffer();

    // Full — встроенный round.circle. Проверяем свежий контракт, не записывая выдуманный payload.
    const sizesURL = api.sizeURL(themeId, tokens.m.id).replace(/\/[^/]+\/value$/u, '');
    const view = (await (await authenticatedRequest(owner, sizesURL, 'GET', [200])).json()) as SizeView;
    for (const [token, valuePx] of [
        [tokens.m, 8],
        [tokens.l, 16],
    ] as const) {
        expect(view.radii.filter((item) => item.tokenId === token.id)).toEqual([
            expect.objectContaining({ tokenId: token.id, valuePx, platforms: {} }),
        ]);
    }
    expect(view.radii.filter((item) => item.tokenId === tokens.circle.id)).toEqual([
        expect.objectContaining({ fullRounding: true, platforms: {} }),
    ]);
    expect(view.spacing.filter((item) => item.tokenId === tokens.spacing.id)).toEqual([
        expect.objectContaining({ valuePx: 8, platforms: {} }),
    ]);
    expect(view.shadows.filter((item) => item.tokenId === tokens.shadow.id)).toEqual([
        expect.objectContaining({ layers: [shadowLayer], platforms: {} }),
    ]);
    return { ...tokens, baseline: await readSizeValues(api, themeId, tokens) };
}
