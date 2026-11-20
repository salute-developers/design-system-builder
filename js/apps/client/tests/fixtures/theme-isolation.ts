import { test as base, expect } from './colors.ts';
import { themeIsolationFixtureTimeoutMs } from '../config/timeouts.ts';
import { prepareColorData } from '../helpers/color-data.ts';
import type { ColorData } from '../helpers/color-data.ts';
import type { ThemeIdentity } from '../helpers/themes.api.ts';

type Fixtures = {
    twoThemes: Readonly<{ first: ThemeIdentity; second: ThemeIdentity; colorData: ColorData }>;
};

/** Вся API-подготовка A/B имеет собственный бюджет, независимо от порядка fixtures. */
export const test = base.extend<Fixtures>({
    twoThemes: [
        async ({ systemsApi, themesApi, tokenValues }, use) => {
            await systemsApi.requireOwner();
            const prepared =
                await test.step('Подготовить Theme A и Theme B с независимым CT-BASE через API', async () => {
                    const first = await themesApi.create('Theme A');
                    expect(first.name).toBe('Theme A');
                    const colorData = await prepareColorData(tokenValues, first.id);
                    expect(colorData.accent.name).toBe('text.default.accent');
                    const second = await themesApi.create('Theme B');
                    await prepareColorData(tokenValues, second.id);
                    return { first, second, colorData };
                });
            await use(prepared);
        },
        { timeout: themeIsolationFixtureTimeoutMs },
    ],
    initialTheme: async ({ twoThemes }, use) => {
        await use(twoThemes.first);
    },
    colorData: async ({ twoThemes }, use) => {
        await use(twoThemes.colorData);
    },
});

export { expect };
