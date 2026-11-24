import { test as base, expect } from './role-sizes.ts';
import { SizesPage } from '../pages/sizes.page.ts';
import { authenticatedRequest } from '../helpers/authentication.ts';
import { readSizeView, type SizeData } from '../helpers/size-data.ts';
import { themeIsolationFixtureTimeoutMs } from '../config/timeouts.ts';

export const test = base.extend<{ sizes: SizesPage; derivedSizeData: SizeData }>({
    sizes: async ({ page, editorURL, pageReadiness }, use) => {
        await use(new SizesPage(page, editorURL.replace(/\/colors$/u, '/shapes'), pageReadiness));
    },
    derivedSizeData: [
        async ({ sizeData, systemsApi, createdSystem, tokenValues, initialTheme, setupSession }, use) => {
            await test.step('Подготовить собственное использование round.l со смещением −2', async () => {
                const url = systemsApi.url('/' + encodeURIComponent(createdSystem.id) + '/component-config/import');
                const response = await authenticatedRequest(setupSession, url, 'POST', [200], {
                    platform: 'web',
                    meta: { name: 'e2e-radius', source: 'e2e' },
                    dryRun: false,
                    components: [
                        {
                            componentName: 'Button',
                            styleName: 'e2e-radius',
                            config: { invariants: { shape: { type: 'shape', value: 'round.l', adjustment: -2 } } },
                        },
                    ],
                });
                expect(
                    await response.json(),
                    'Импорт собственной конфигурации без потерь и предупреждений',
                ).toMatchObject({
                    created: 1,
                    updated: 0,
                    unchanged: 0,
                    rejected: [],
                    unresolvedTokens: [],
                    unresolvedComponentStyles: [],
                    unknownProperties: [],
                    unknownStates: [],
                    typeMismatches: [],
                    gradientOnlyProperties: [],
                    underivableVariationIds: [],
                });
                const view = await readSizeView(tokenValues, initialTheme.id, setupSession);
                const source = view.radii.find((token) => token.tokenId === sizeData.l.id);
                expect(source?.derived, 'GET подтверждает использование, добавленное подготовкой').toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            offsetPx: -2,
                            valuePx: 14,
                            usages: expect.arrayContaining([{ component: 'Button', platform: 'web', parameter: null }]),
                        }),
                    ]),
                );
            });
            await use(sizeData);
        },
        { timeout: themeIsolationFixtureTimeoutMs },
    ],
});

export { expect };
