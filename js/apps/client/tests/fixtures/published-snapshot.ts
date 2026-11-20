import { mergeTests } from '@playwright/test';
import { test as sizesTest, expect } from './sizes.ts';
import { test as paletteTest } from './palette.ts';
import { authenticatedRequest } from '../helpers/authentication.ts';
import { exactDefinition, exactValue } from '../helpers/color-data.ts';
import { green, paletteGroup } from '../helpers/palette.api.ts';
import type { PublishedVersion } from '../helpers/versions.api.ts';

export const snapshotPalette = { published: '#197844', draft: '#3366CC' } as const;
export const draftColor = '#3366CC';
export const draftFontSize = 19;
const draftShadow = { offsetX: 4, offsetY: 24, blur: 40, spread: -6, color: '#0000003D' } as const;

type SnapshotData = {
    version: PublishedVersion;
    accentGroupId: string;
    shadowId: string;
    historicalLight: string;
    publishedChanges: number;
};

const base = mergeTests(sizesTest, paletteTest);

export const test = base.extend<{ snapshot: SnapshotData }>({
    snapshot: [
        async ({ initialTheme, paletteApi, tokenValues, versionsApi, setupSession }, use) => {
            const themeId = initialTheme.id;
            const accentGroup = paletteGroup(await paletteApi.prepare(), 'accent');
            await paletteApi.seedStep(accentGroup.id, green, 500, snapshotPalette.published);
            const definitions = await tokenValues.definitions();
            const accent = exactDefinition(definitions, 'text.default.accent');
            const shadow = exactDefinition(definitions, 'down.hard.m');
            const typography = ['normal', 'medium', 'bold'].map((weight) =>
                exactDefinition(definitions, 'screen-l.body.m.' + weight),
            );

            const values = await tokenValues.values(themeId, 'color,shadow,typography');
            const light = exactValue(values, accent.id, 'light');
            expect(light.value).toEqual([expect.stringMatching(/^#[0-9A-F]{6}$/iu)]);
            const historicalLight = (light.value as [string])[0];
            expect(historicalLight.toUpperCase()).not.toBe(draftColor);
            const publishedChanges = (await versionsApi.changes()).length;
            const version = await versionsApi.publish('0.1.0', 'QA published snapshot');
            expect(await versionsApi.changes()).toEqual([]);

            await paletteApi.seedStep(accentGroup.id, green, 500, snapshotPalette.draft);
            await tokenValues.seed(themeId, [{ current: light, value: draftColor }]);
            const shadowValues = values.filter((value) => value.tokenId === shadow.id);
            expect(shadowValues.map((value) => value.platform).sort()).toEqual(['android', 'ios', 'web']);
            const shadowResponse = await authenticatedRequest(
                setupSession,
                tokenValues.sizeURL(themeId, shadow.id),
                'PUT',
                [200],
                {
                    layers: [draftShadow],
                    fallbackElevation: 4,
                    platforms: {},
                    baseRevisions: Object.fromEntries(
                        shadowValues.map((value) => [value.platform, value.editRevision]),
                    ),
                },
            );
            await shadowResponse.arrayBuffer();

            const typographyValues = values.filter((value) => typography.some((token) => token.id === value.tokenId));
            expect(typographyValues).toHaveLength(9);
            const typographyResponse = await authenticatedRequest(
                setupSession,
                tokenValues.typographyStyleURL(themeId, typography[0]!.id),
                'PATCH',
                [200],
                {
                    size: draftFontSize,
                    baseRevisions: typographyValues.map((value) => ({
                        tokenId: value.tokenId,
                        platform: value.platform,
                        baseRevision: value.editRevision,
                    })),
                },
            );
            await typographyResponse.arrayBuffer();
            await use({
                version,
                accentGroupId: accentGroup.id,
                shadowId: shadow.id,
                historicalLight,
                publishedChanges,
            });
        },
        { timeout: 120_000 },
    ],
});

export { expect };
