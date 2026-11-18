import type { Request } from '@playwright/test';
import { test, expect } from '../fixtures/roles.ts';

test(
    'PLASMABLDR-T535: PROJ-UI-017 RBAC: direct URL запрещённой Project Settings не даёт mutation',
    { annotation: { type: 'zephyr', description: 'PLASMABLDR-T535' } },
    async ({ page, environment, roleProject, projectAccess }) => {
        const scope = new URL(`api/projects/${encodeURIComponent(roleProject.id)}`, environment.gatewayBaseURL);
        const mutations: string[] = [];
        const observe = (request: Request) => {
            const url = new URL(request.url());
            if (
                ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method()) &&
                url.origin === scope.origin &&
                (url.pathname === scope.pathname || url.pathname.startsWith(scope.pathname + '/'))
            ) {
                mutations.push(request.method() + ' ' + url.pathname);
            }
        };
        page.on('request', observe);
        try {
            await test.step('Открыть прямой URL настроек под Viewer', async () => {
                await projectAccess.openSettings();
                await expect(page).toHaveURL(projectAccess.settingsURL);
                await expect(projectAccess.denied).toBeVisible();
            });
            await test.step('Проверить отсутствие изменяемой формы и запросов записи', async () => {
                await expect(projectAccess.nameInput).toHaveCount(0);
                await expect(projectAccess.descriptionInput).toHaveCount(0);
                await expect(projectAccess.saveButton).toHaveCount(0);
                expect(mutations, 'Прямой переход Viewer не отправляет мутации проекта').toEqual([]);
            });
        } finally {
            page.off('request', observe);
        }
    },
);
