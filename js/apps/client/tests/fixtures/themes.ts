import { test as base, expect } from './design-system.ts';
import { ThemesApi } from '../helpers/themes.api.ts';
import type { ThemeIdentity } from '../helpers/themes.api.ts';
import { CreateThemePage } from '../pages/create-theme.page.ts';

type Fixtures = {
    themesApi: ThemesApi;
    createTheme: CreateThemePage;
    initialTheme: ThemeIdentity;
    themeCreations: () => number;
};

/** Все темы очищаются вместе с отдельной createdSystem, включая ошибки создания. */
export const test = base.extend<Fixtures>({
    themesApi: async ({ environment, systemsApi, createdSystem, session }, use) => {
        await use(new ThemesApi(environment.gatewayBaseURL, systemsApi.projectId, createdSystem.id, session));
    },
    createTheme: async ({ page, pageReadiness }, use) => {
        await use(new CreateThemePage(page, pageReadiness));
    },
    initialTheme: async ({ systemsApi, themesApi }, use) => {
        await systemsApi.requireOwner();
        const theme = await themesApi.create('Theme A');
        expect(theme.name).toBe('Theme A');
        await use(theme);
    },
    themeCreations: async ({ page, themesApi }, use) => {
        let count = 0;
        page.on('request', (request) => {
            if (request.url() === themesApi.createURL && request.method() === 'POST') count += 1;
        });
        await use(() => count);
    },
});

export { expect };
