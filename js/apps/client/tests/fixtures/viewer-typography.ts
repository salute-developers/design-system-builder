import { test as base, expect } from './role-colors.ts';
import { prepareViewerTypography } from '../helpers/viewer-typography-data.ts';
import { ViewerTypographyPage } from '../pages/viewer-typography.page.ts';
import { themeIsolationFixtureTimeoutMs } from '../config/timeouts.ts';

type Data = Awaited<ReturnType<typeof prepareViewerTypography>>;
export const test = base.extend<{ viewerTypographyData: Data; viewerTypography: ViewerTypographyPage }>({
    viewerTypographyData: [
        async ({ tokenValues, initialTheme, setupSession, systemsApi, createdSystem }, use) => {
            await systemsApi.requireOwner();
            expect(await systemsApi.get(createdSystem.id)).toMatchObject({
                id: createdSystem.id,
                projectId: systemsApi.projectId,
                isTechnical: false,
            });
            await use(
                await test.step('Owner готовит типографику и свои размеры iOS', () =>
                    prepareViewerTypography(tokenValues, initialTheme.id, setupSession)),
            );
        },
        { timeout: themeIsolationFixtureTimeoutMs },
    ],
    viewerTypography: async ({ page, editorURL, pageReadiness }, use) => {
        await use(new ViewerTypographyPage(page, editorURL.replace(/\/colors$/u, '/typography'), pageReadiness));
    },
});
export { expect };
