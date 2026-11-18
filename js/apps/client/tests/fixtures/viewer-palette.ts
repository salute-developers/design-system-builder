import { mergeTests } from '@playwright/test';
import { test as paletteTest } from './palette.ts';
import { test as rolesTest, expect } from './role-colors.ts';
import { prepareViewerPalette } from '../helpers/viewer-palette-data.ts';
import { ViewerPalettePage } from '../pages/viewer-palette.page.ts';
import { themeIsolationFixtureTimeoutMs } from '../config/timeouts.ts';

const base = mergeTests(paletteTest, rolesTest);
type Data = Awaited<ReturnType<typeof prepareViewerPalette>>;
export const test = base.extend<{ viewerPaletteData: Data; viewerPalette: ViewerPalettePage }>({
    viewerPaletteData: [
        async ({ paletteApi, tokenValues, initialTheme, systemsApi, createdSystem }, use) => {
            await systemsApi.requireOwner();
            expect(await systemsApi.get(createdSystem.id)).toMatchObject({
                id: createdSystem.id,
                projectId: systemsApi.projectId,
                isTechnical: false,
            });
            await use(
                await test.step('Owner готовит палитру и ссылку textAccent', () =>
                    prepareViewerPalette(paletteApi, tokenValues, initialTheme.id)),
            );
        },
        { timeout: themeIsolationFixtureTimeoutMs },
    ],
    viewerPalette: async ({ page, editorURL, pageReadiness }, use) => {
        await use(new ViewerPalettePage(page, editorURL.replace(/\/colors$/u, '/palette'), pageReadiness));
    },
});
export { expect };
