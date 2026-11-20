import { expect } from '@playwright/test';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';
import { exactDefinition } from './color-data.ts';
import type { TokenValuesApi, TokenDefinition, TokenValue } from './token-values.api.ts';

export const typographyBaseline = [
    { screen: 'l', label: 'Крупные', size: 16, lineHeight: 20 },
    { screen: 'm', label: 'Средние', size: 15, lineHeight: 20 },
    { screen: 's', label: 'Мелкие', size: 14, lineHeight: 18 },
] as const;

/** Точные значения FIX-BASE во всех платформах, без зависимости от стандартного профиля. */
export async function prepareTypographyData(
    api: TokenValuesApi,
    themeId: string,
    session: Session,
): Promise<TokenDefinition[]> {
    const definitions = await api.definitions();
    const selected: TokenDefinition[] = [];
    for (const { screen, size, lineHeight } of typographyBaseline) {
        const family = ['normal', 'medium', 'bold'].map((weight) =>
            exactDefinition(definitions, `screen-${screen}.body.m.${weight}`),
        );
        const values = (await api.values(themeId, 'typography')).filter((value) =>
            family.some((token) => token.id === value.tokenId),
        );
        expect(values).toHaveLength(9);
        expect(values.every((value) => !value.overridden)).toBe(true);
        const response = await authenticatedRequest(
            session,
            api.typographyStyleURL(themeId, family[0]!.id),
            'PATCH',
            [200],
            {
                size,
                lineHeight,
                letterSpacing: 0,
                baseRevisions: values.map((value) => ({
                    tokenId: value.tokenId,
                    platform: value.platform,
                    baseRevision: value.editRevision,
                })),
            },
        );
        await response.arrayBuffer();
        selected.push(...family);
    }
    return selected;
}

export function typographyWebValue(values: readonly TokenValue[], tokenId: string): unknown {
    const matches = values.filter((value) => value.tokenId === tokenId && value.platform === 'web');
    expect(matches).toHaveLength(1);
    return matches[0]!.value;
}
