import { test as base, expect } from '@playwright/test';
import { readEnvironment } from '../config/environment.ts';
import type { Environment } from '../config/environment.ts';
import { authenticate } from '../helpers/authentication.ts';
import type { Session } from '../helpers/authentication.ts';
import { baselineView, DesignSystemApi } from '../helpers/design-system.api.ts';
import { uniqueSystemName } from '../helpers/test-data.ts';
import { prepareProject } from '../helpers/project.ts';
import type { SystemTestData } from '../helpers/test-data.ts';
import { DesignSystemsPage } from '../pages/design-systems.page.ts';
import { DesignSystemSteps } from '../steps/design-system.steps.ts';

type Fixtures = {
    environment: Environment;
    session: Session;
    systemsApi: DesignSystemApi;
    systems: DesignSystemsPage;
    steps: DesignSystemSteps;
    systemData: SystemTestData;
};

export const test = base.extend<Fixtures>({
    environment: async ({}, use) => {
        await use(await readEnvironment());
    },
    session: async ({ environment }, use) => {
        const session = await authenticate(environment);
        try {
            await use(session);
        } finally {
            await session.close();
        }
    },
    storageState: async ({ session }, use) => {
        await use(session.storageState);
    },
    systemsApi: async ({ environment, session }, use) => {
        const project = await test.step('Подготовка собственного E2E-проекта', () =>
            prepareProject(environment, session));
        test.info().annotations.push({ type: 'e2e-project', description: project.id });
        const api = new DesignSystemApi(environment.gatewayBaseURL, project.id, session);
        await use(api);
    },
    systems: async ({ page, environment, systemsApi }, use) => {
        await use(new DesignSystemsPage(page, environment.clientBaseURL, systemsApi.projectId));
    },
    systemData: async ({ systemsApi }, use) => {
        const name = uniqueSystemName();
        const expected = { name, projectId: systemsApi.projectId, isTechnical: false };
        const baseline = await systemsApi.list();
        test.info().annotations.push({ type: 'baseline-count', description: String(baseline.length) });
        let createdId: string | undefined;
        let attempted = false;
        const cleanup = () =>
            test.step('Очистка своего ID и проверка исходных систем', async () => {
                if (!createdId) {
                    if (attempted)
                        throw new Error(
                            `Результат POST не подтверждён (${name}); автоматическое удаление по имени запрещено.`,
                        );
                    return;
                }
                await systemsApi.requireOwner();
                const current = await systemsApi.get(createdId);
                if (current) {
                    expect(current, 'Свежий GET должен подтвердить принадлежность перед DELETE').toMatchObject({
                        ...expected,
                        id: createdId,
                    });
                    await systemsApi.remove(createdId); // Одна попытка, без скрытого повторения DELETE.
                }
                expect(
                    await systemsApi.get(createdId),
                    `После cleanup ID ${createdId} должен возвращать 404`,
                ).toBeNull();
                expect(baselineView(await systemsApi.list()), 'Исходные системы проекта должны сохраниться').toEqual(
                    baselineView(baseline),
                );
            });
        try {
            await use({
                name,
                projectId: systemsApi.projectId,
                creationAttempted: () => {
                    attempted = true;
                },
                register: (system) => {
                    const value = system as { id?: string; name?: string; projectId?: string } | null;
                    const id = value?.id;
                    expect(
                        { id, name: value?.name, projectId: value?.projectId },
                        'Идентичность созданной системы',
                    ).toMatchObject({
                        id: expect.stringMatching(/\S/u),
                        name,
                        projectId: systemsApi.projectId,
                    });
                    expect(
                        baseline.some((original) => original.id === id),
                        'ID не должен принадлежать исходной системе',
                    ).toBe(false);
                    expect(createdId, 'Повторная регистрация создания запрещена').toBeUndefined();
                    createdId = id as string;
                    test.info().annotations.push({ type: 'created-design-system', description: createdId });
                },
            });
        } finally {
            await cleanup();
        }
    },
    steps: async ({ page, systems, systemsApi, systemData }, use) => {
        await use(new DesignSystemSteps(page, systems, systemsApi, systemData));
    },
});

export { expect };
