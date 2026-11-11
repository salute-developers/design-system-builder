import { test as base, expect } from './versions.ts';
import { TokenValuesApi } from '../helpers/token-values.api.ts';
import { exactValue, prepareColorData } from '../helpers/color-data.ts';
import type { ColorData } from '../helpers/color-data.ts';
import { ColorTokenSteps } from '../steps/color-token.steps.ts';
import { ColorEditorPage } from '../pages/color-editor.page.ts';

type Fixtures = {
    tokenValues: TokenValuesApi;
    colorData: ColorData;
    changedColor: ColorData;
    colors: ColorEditorPage;
    colorSteps: ColorTokenSteps;
};

export const test = base.extend<Fixtures>({
    tokenValues: async ({ environment, systemsApi, createdSystem, setupSession }, use) => {
        await use(new TokenValuesApi(environment.gatewayBaseURL, systemsApi.projectId, createdSystem.id, setupSession));
    },
    colorData: async ({ tokenValues, initialTheme }, use) => {
        await use(
            await test.step('Подготовить независимый CT-BASE через API', () =>
                prepareColorData(tokenValues, initialTheme.id)),
        );
    },
    changedColor: async ({ colorData, tokenValues, versionsApi, initialTheme }, use) => {
        await versionsApi.publish('0.1.0', 'QA color baseline');
        expect(await versionsApi.changes()).toEqual([]);
        const value = exactValue(
            await tokenValues.values(initialTheme.id, 'color,gradient'),
            colorData.accent.id,
            'light',
        );
        await tokenValues.seed(initialTheme.id, [{ current: value, value: '#3366CC' }]);
        await use(colorData);
    },
    colorSteps: async ({ colors, pendingMutation }, use) => {
        await use(new ColorTokenSteps(colors, pendingMutation));
    },
    colors: async ({ page, editorURL, pageReadiness }, use) => {
        await use(new ColorEditorPage(page, editorURL, pageReadiness));
    },
});

export { expect };
