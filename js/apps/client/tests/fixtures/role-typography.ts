import { test as base, expect } from './role-colors.ts';
import { themeIsolationFixtureTimeoutMs } from '../config/timeouts.ts';
import { prepareTypographyData } from '../helpers/typography-data.ts';
import type { TokenDefinition } from '../helpers/token-values.api.ts';
import { TypographyPage } from '../pages/typography.page.ts';

export const test = base.extend<{ typographyData: TokenDefinition[]; typography: TypographyPage }>({
    typographyData: [
        async ({ tokenValues, initialTheme, setupSession, versionsApi }, use) => {
            const data = await test.step('Подготовить Body M для трёх экранов по FIX-BASE', () =>
                prepareTypographyData(tokenValues, initialTheme.id, setupSession));
            await test.step('Зафиксировать FIX-BASE и начать с пустого черновика', async () => {
                await versionsApi.publish('0.1.0', 'T695 FIX-BASE');
                expect(
                    await versionsApi.changes(),
                    'Подготовительные записи не входят в журнал проверяемых правок',
                ).toEqual([]);
            });
            await use(data);
        },
        { timeout: themeIsolationFixtureTimeoutMs },
    ],
    typography: async ({ page }, use) => {
        await use(new TypographyPage(page));
    },
});

export { expect };
