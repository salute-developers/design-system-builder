import { test as base, expect } from './test.ts';
import { baselineView, designSystem } from '../helpers/design-system.api.ts';
import type { DesignSystem } from '../helpers/design-system.api.ts';
import { resourceFixtureTimeoutMs } from '../config/timeouts.ts';
import { PendingMutation } from '../helpers/pending-mutation.ts';
import { uniqueSystemName } from '../helpers/test-data.ts';
import type { Session } from '../helpers/authentication.ts';
import { DesignSystemSettingsPage } from '../pages/design-system-settings.page.ts';

type Fixtures = {
    createdSystem: DesignSystem;
    pendingMutation: PendingMutation;
    setupSession: Session;
    systemSettings: DesignSystemSettingsPage;
};

/** Подготовка отдельной ДС через API; UI-пилот использует прежнюю fixture. */
export const test = base.extend<Fixtures>({
    pendingMutation: async ({ page, environment, systemsApi }, use) => {
        const guard = new PendingMutation(page);
        const stopWatching = guard.watchBrowserWrites(environment.gatewayBaseURL, systemsApi.projectId);
        try {
            await use(guard);
        } finally {
            stopWatching();
        }
    },
    setupSession: async ({ session, pendingMutation }, use) => {
        await use({ ...session, trackWrite: (send) => pendingMutation.trackApi(send) });
    },
    createdSystem: [
        async ({ systemsApi, pendingMutation }, use, info) => {
            const name = uniqueSystemName();
            const baseline = await systemsApi.list();
            let createdId: string | undefined;
            let scenarioCompleted = false;
            info.annotations.push({ type: 'creation-name', description: name });
            try {
                const raw = await test.step('Подготовка отдельной ДС через API', () => systemsApi.create(name));
                const identity = raw as Partial<DesignSystem> | null;
                expect(identity, 'Идентичность созданной ДС').toMatchObject({
                    id: expect.stringMatching(/\S/u),
                    name,
                    projectId: systemsApi.projectId,
                });
                const id = (raw as { id: string }).id;
                expect(
                    baseline.some((system) => system.id === id),
                    'Новая ДС не принадлежит baseline',
                ).toBe(false);
                createdId = id;
                info.annotations.push({ type: 'created-design-system', description: id });
                const system = designSystem(raw);
                expect(system.isTechnical, 'Подготовлена обычная ДС').toBe(false);
                await use(system);
                scenarioCompleted = true;
            } finally {
                await test.step('Очистка подготовленной ДС с учётом переименования', async () => {
                    const systemId = createdId;
                    if (!systemId) return;
                    const retain = (reason: string) => {
                        info.annotations.push({ type: 'retained-design-system', description: systemId });
                        console.warn(
                            `[e2e:cleanup] ДС ${systemId} сохранена в проекте ${systemsApi.projectId}. ${reason}`,
                        );
                    };
                    const scenarioPassed = () =>
                        scenarioCompleted && info.status === 'passed' && info.expectedStatus === 'passed';
                    if (!scenarioPassed()) {
                        retain('Сценарий не завершился успешно.');
                        return;
                    }
                    try {
                        await test.step('Закрыть браузерный контекст и проверить наблюдаемые записи', () =>
                            pendingMutation.waitBeforeCleanup(systemId));
                    } catch (error) {
                        retain('Завершение записей или закрытие контекста не подтверждено.');
                        throw error;
                    }
                    await systemsApi.requireOwner();
                    const current = await systemsApi.get(systemId);
                    if (current) {
                        expect(current, 'Подтверждённый ID остаётся обычной ДС своего проекта').toMatchObject({
                            id: systemId,
                            projectId: systemsApi.projectId,
                            isTechnical: false,
                        });
                        if (!scenarioPassed()) {
                            retain('Прогон прерван до отправки DELETE.');
                            return;
                        }
                        await systemsApi.remove(systemId);
                    }
                    expect(await systemsApi.get(systemId), 'После очистки GET возвращает 404').toBeNull();
                    expect(baselineView(await systemsApi.list()), 'Исходные системы сохранены').toEqual(
                        baselineView(baseline),
                    );
                });
            }
        },
        { timeout: resourceFixtureTimeoutMs },
    ],
    systemSettings: async ({ page }, use) => {
        await use(new DesignSystemSettingsPage(page));
    },
});

export { expect };
