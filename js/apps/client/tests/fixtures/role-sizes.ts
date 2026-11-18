import { test as base, expect } from './role-colors.ts';
import { themeIsolationFixtureTimeoutMs } from '../config/timeouts.ts';
import { prepareSizeData } from '../helpers/size-data.ts';
import type { SizeData } from '../helpers/size-data.ts';
import { ViewerSizesPage } from '../pages/viewer-sizes.page.ts';

export const test = base.extend<{ sizeData: SizeData; viewerSizes: ViewerSizesPage }>({
    sizeData: [
        async ({ tokenValues, initialTheme, setupSession, systemsApi, createdSystem }, use) => {
            await systemsApi.requireOwner();
            expect(await systemsApi.get(createdSystem.id)).toMatchObject({
                id: createdSystem.id,
                projectId: systemsApi.projectId,
                isTechnical: false,
            });
            await use(
                await test.step('Подготовить независимый RSS-BASE через Owner API', () =>
                    prepareSizeData(tokenValues, initialTheme.id, setupSession)),
            );
        },
        { scope: 'test', timeout: themeIsolationFixtureTimeoutMs },
    ],
    viewerSizes: async ({ page, editorURL, pageReadiness }, use) => {
        await use(new ViewerSizesPage(page, editorURL.replace(/\/colors$/u, '/shapes'), pageReadiness));
    },
});

export { expect };
