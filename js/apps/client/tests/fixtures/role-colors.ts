import { prepareColorData } from '../helpers/color-data.ts';
import { themeIsolationFixtureTimeoutMs } from '../config/timeouts.ts';
import { mergeTests } from '@playwright/test';
import { test as colorsTest } from './colors.ts';
import { test as rolesTest, expect } from './roles.ts';
import { DesignSystemApi } from '../helpers/design-system.api.ts';
import { ViewerColorsPage } from '../pages/viewer-colors.page.ts';

const base = mergeTests(colorsTest, rolesTest);

/** Owner готовит свою ДС; сессия браузера и проект задаются ролевой fixture. */
export const test = base.extend<{ viewerColors: ViewerColorsPage }>({
    systemsApi: async ({ environment, session, roleProject }, use) => {
        await use(new DesignSystemApi(environment.gatewayBaseURL, roleProject.id, session));
    },
    colorData: [
        async ({ tokenValues, initialTheme }, use) => {
            await use(
                await test.step('Подготовить независимый CT-BASE через API', () =>
                    prepareColorData(tokenValues, initialTheme.id)),
            );
        },
        { scope: 'test', timeout: themeIsolationFixtureTimeoutMs },
    ],
    viewerColors: async ({ page }, use) => {
        await use(new ViewerColorsPage(page));
    },
});

export { expect };
