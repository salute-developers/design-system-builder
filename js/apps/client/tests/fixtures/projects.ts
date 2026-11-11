import { test as base, expect } from './test.ts';
import { ProjectsPage } from '../pages/projects.page.ts';

type Fixtures = {
    projects: ProjectsPage;
    projectCreations: () => number;
};

export const test = base.extend<Fixtures>({
    projects: async ({ page, environment }, use) => {
        await use(new ProjectsPage(page, new URL('projects', environment.clientBaseURL).href));
    },
    projectCreations: async ({ page, environment }, use) => {
        const url = new URL('api/projects', environment.gatewayBaseURL).href;
        let count = 0;
        page.on('request', (request) => {
            if (request.url() === url && request.method() === 'POST') count += 1;
        });
        await use(() => count);
    },
});

export { expect };
