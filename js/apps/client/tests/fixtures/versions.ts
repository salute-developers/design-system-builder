import { test as base, expect } from './themes.ts';
import type { ThemeIdentity } from '../helpers/themes.api.ts';
import { VersionsApi } from '../helpers/versions.api.ts';
import type { PublishedVersion } from '../helpers/versions.api.ts';
import { JournalPage } from '../pages/journal.page.ts';
import { VersionsPage } from '../pages/versions.page.ts';

type Fixtures = {
    versionsApi: VersionsApi;
    baselineVersion: PublishedVersion;
    pendingTheme: ThemeIdentity;
    history: Readonly<{ first: PublishedVersion; second: PublishedVersion; draftTheme: ThemeIdentity }>;
    editorURL: string;
    journal: JournalPage;
    versions: VersionsPage;
    publications: () => number;
};

/** Каждый тест получает собственную ДС; публикации удаляются родительским cleanup. */
export const test = base.extend<Fixtures>({
    versionsApi: async ({ environment, systemsApi, createdSystem, setupSession }, use) => {
        await systemsApi.requireOwner();
        await use(new VersionsApi(environment.gatewayBaseURL, systemsApi.projectId, createdSystem.id, setupSession));
    },
    baselineVersion: async ({ versionsApi, initialTheme }, use) => {
        const version = await test.step('Опубликовать исходное состояние ' + initialTheme.name + ' через API', () =>
            versionsApi.publish('0.1.0', 'QA baseline'),
        );
        expect(await versionsApi.changes(), 'После публикации черновик пуст').toEqual([]);
        await use(version);
    },
    pendingTheme: async ({ baselineVersion, themesApi, initialTheme }, use) => {
        const theme = await test.step('Подготовить правку темы после ' + baselineVersion.version, () =>
            themesApi.rename(initialTheme.id, 'QA Published Theme'),
        );
        await use(theme);
    },
    history: async ({ baselineVersion, pendingTheme, versionsApi, themesApi }, use) => {
        const second = await test.step('Подготовить вторую публикацию через API', () =>
            versionsApi.publish('0.1.1', 'QA next version'));
        const draftTheme = await themesApi.rename(pendingTheme.id, 'QA Draft Theme');
        await use({ first: baselineVersion, second, draftTheme });
    },
    editorURL: async ({ systems, createdSystem, initialTheme }, use) => {
        await use(systems.systemURL(createdSystem.id) + '/themes/' + encodeURIComponent(initialTheme.id) + '/colors');
    },
    journal: async ({ page, editorURL, pageReadiness }, use) => {
        await use(new JournalPage(page, editorURL, pageReadiness));
    },
    versions: async ({ page, editorURL, pageReadiness }, use) => {
        await use(new VersionsPage(page, editorURL, pageReadiness));
    },
    publications: async ({ page, versionsApi }, use) => {
        let count = 0;
        const observe = (request: { url(): string; method(): string }) => {
            if (request.url() === versionsApi.createURL && request.method() === 'POST') count += 1;
        };
        page.on('request', observe);
        try {
            await use(() => count);
        } finally {
            page.off('request', observe);
        }
    },
});

export { expect };
