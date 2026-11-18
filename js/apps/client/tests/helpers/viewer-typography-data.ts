import { expect } from '@playwright/test';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';
import { prepareTypographyData, typographyBaseline } from './typography-data.ts';
import type { TokenDefinition, TokenValuesApi } from './token-values.api.ts';

export const viewerTypographyScreens = typographyBaseline.map((screen) => ({
    ...screen,
    iosSize: screen.screen === 'l' ? 17 : screen.size,
}));

export async function readViewerTypography(api: TokenValuesApi, themeId: string, tokens: readonly TokenDefinition[]) {
    const values = (await api.values(themeId, 'typography')).filter((value) =>
        tokens.some((token) => token.id === value.tokenId),
    );
    expect(values).toHaveLength(27);
    for (const token of tokens) {
        expect(
            values
                .filter((value) => value.tokenId === token.id)
                .map((value) => value.platform)
                .sort(),
        ).toEqual(['android', 'ios', 'web']);
    }
    return values
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

/** FIX-BASE всех экранов и FIX-IOS-SIZE=17 только для Body M крупных экранов. */
export async function prepareViewerTypography(api: TokenValuesApi, themeId: string, owner: Session) {
    const tokens = await prepareTypographyData(api, themeId, owner);
    for (const { screen, iosSize } of viewerTypographyScreens.filter((item) => item.screen === 'l')) {
        const family = tokens.filter((token) => token.name.startsWith(`screen-${screen}.`));
        expect(family).toHaveLength(3);
        const values = (await api.values(themeId, 'typography')).filter((value) =>
            family.some((token) => token.id === value.tokenId),
        );
        expect(values).toHaveLength(9);
        const response = await authenticatedRequest(
            owner,
            api.typographyStyleURL(themeId, family[0]!.id),
            'PATCH',
            [200],
            {
                platform: 'ios',
                size: iosSize,
                baseRevisions: values.map(({ tokenId, platform, editRevision }) => ({
                    tokenId,
                    platform,
                    baseRevision: editRevision,
                })),
            },
        );
        await response.arrayBuffer();
    }
    const baseline = await readViewerTypography(api, themeId, tokens);
    // У типографики свои платформенные значения определяются отличием полей, не флагом overridden.
    for (const { screen, size, lineHeight, iosSize } of viewerTypographyScreens) {
        for (const token of tokens.filter((item) => item.name.startsWith(`screen-${screen}.`))) {
            expect(baseline.find((value) => value.tokenId === token.id && value.platform === 'web')?.value).toEqual([
                expect.objectContaining({ fontSize: `${size / 16}rem`, lineHeight: `${lineHeight / 16}rem` }),
            ]);
            expect(baseline.find((value) => value.tokenId === token.id && value.platform === 'ios')?.value).toEqual([
                expect.objectContaining({ size: iosSize, lineHeight }),
            ]);
        }
    }
    return { tokens, baseline };
}
