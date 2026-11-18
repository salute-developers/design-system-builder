import { within } from '../helpers/pending-mutation.ts';
import { systemCreationSettlementTimeoutMs } from '../config/timeouts.ts';
import { test as base, expect } from '@playwright/test';
import { resourceFixtureTimeoutMs, sessionFixtureTimeoutMs } from '../config/timeouts.ts';
import { PageReadiness } from '../helpers/page-readiness.ts';
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
    pageReadiness: PageReadiness;
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
    pageReadiness: [
        async ({ page }, use, info) => {
            const readiness = new PageReadiness(page, info);
            try {
                await use(readiness);
            } finally {
                if (info.status !== info.expectedStatus) await readiness.report('Падение сценария');
                readiness.dispose();
            }
        },
        { auto: true },
    ],
    session: [
        async ({ environment }, use) => {
            const session = await authenticate(environment);
            try {
                await use(session);
            } finally {
                await session.close();
            }
        },
        { timeout: sessionFixtureTimeoutMs },
    ],
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
    systemData: [
        async ({ systemsApi }, use, info) => {
            const name = uniqueSystemName();
            const expected = { name, projectId: systemsApi.projectId, isTechnical: false };
            const baseline = await systemsApi.list();
            info.annotations.push({ type: 'baseline-count', description: String(baseline.length) });
            let createdId: string | undefined;
            let attempted = false;
            let creation: Promise<unknown> | undefined;
            let settlementDeadline = 0;
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
                    expect(
                        baselineView(await systemsApi.list()),
                        'Исходные системы проекта должны сохраниться',
                    ).toEqual(baselineView(baseline));
                });
            try {
                await use({
                    name,
                    projectId: systemsApi.projectId,
                    observeCreation: (operation) => {
                        if (creation) throw new Error('Повторное UI-создание ДС запрещено.');
                        creation = operation;
                        settlementDeadline = performance.now() + systemCreationSettlementTimeoutMs;
                        void operation.catch(() => {});
                    },
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
                        info.annotations.push({ type: 'created-design-system', description: createdId });
                    },
                });
            } finally {
                let settlementError: unknown;
                if (creation) {
                    try {
                        await within(
                            creation,
                            Math.max(0, settlementDeadline - performance.now()),
                            'Результат UI-создания ДС не подтверждён за 60 секунд.',
                        );
                    } catch (error) {
                        settlementError = error;
                        if (!createdId) {
                            info.annotations.push({ type: 'unconfirmed-design-system-creation', description: name });
                            throw new Error('ID созданной ДС не подтверждён; DELETE по имени запрещён. Имя: ' + name, {
                                cause: error,
                            });
                        }
                    }
                }
                // Только пилот: дождаться позднего ID до cleanup и завершения fixture.
                await cleanup();
                if (settlementError) throw settlementError;
            }
        },
        { timeout: resourceFixtureTimeoutMs },
    ],
    steps: async ({ page, systems, systemsApi, systemData }, use) => {
        await use(new DesignSystemSteps(page, systems, systemsApi, systemData));
    },
});

export { expect };
