import { test as base, expect } from './role-colors.ts';
import { themeIsolationFixtureTimeoutMs } from '../config/timeouts.ts';
import { prepareColorData } from '../helpers/color-data.ts';
import type { ThemeIdentity } from '../helpers/themes.api.ts';

export const test = base.extend<{ secondTheme: ThemeIdentity }>({
    secondTheme: [
        async ({ initialTheme, themesApi, tokenValues }, use) => {
            expect(initialTheme.name).toBe('Theme A');
            const second = await themesApi.create('Theme B');
            await prepareColorData(tokenValues, second.id);
            await use(second);
        },
        { timeout: themeIsolationFixtureTimeoutMs },
    ],
});

export { expect };
