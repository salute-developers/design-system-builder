import { test as base, expect } from './colors.ts';
import { prepareTypographyData } from '../helpers/typography-data.ts';
import type { TokenDefinition } from '../helpers/token-values.api.ts';
import type { ThemeIdentity } from '../helpers/themes.api.ts';
import { TypographyPage } from '../pages/typography.page.ts';

export const test = base.extend<{
    typographyIsolation: { second: ThemeIdentity; definitions: TokenDefinition[] };
    typography: TypographyPage;
}>({
    typographyIsolation: [
        async ({ initialTheme, themesApi, tokenValues, setupSession }, use) => {
            const definitions = await prepareTypographyData(tokenValues, initialTheme.id, setupSession);
            const second = await themesApi.create('Theme B');
            await prepareTypographyData(tokenValues, second.id, setupSession);
            await use({ second, definitions });
        },
        { timeout: 120_000 },
    ],
    typography: async ({ page }, use) => {
        await use(new TypographyPage(page));
    },
});
export { expect };
