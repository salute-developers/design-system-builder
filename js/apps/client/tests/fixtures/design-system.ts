import { test as base, expect } from './test.ts';
import { baselineView, designSystem } from '../helpers/design-system.api.ts';
import type { DesignSystem } from '../helpers/design-system.api.ts';
import { resourceFixtureTimeoutMs } from '../config/timeouts.ts';
import { PendingMutation } from '../helpers/pending-mutation.ts';
import { uniqueSystemName } from '../helpers/test-data.ts';
import { DesignSystemSettingsPage } from '../pages/design-system-settings.page.ts';

type Fixtures = {
    createdSystem: DesignSystem;
    pendingMutation: PendingMutation;
    systemSettings: DesignSystemSettingsPage;
};

/** Подготовка отдельной ДС через API; UI-пилот использует прежнюю fixture. */
export const test = base.extend<Fixtures>({
    pendingMutation: async ({ page }, use) => {
        await use(new PendingMutation(page));
    },
    createdSystem: [
        async ({ systemsApi, pendingMutation }, use) => {
            const name = uniqueSystemName();
            const baseline = await systemsApi.list();
            let createdId: string | undefined;
            test.info().annotations.push({ type: 'creation-name', description: name });
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
                test.info().annotations.push({ type: 'created-design-system', description: id });
                const system = designSystem(raw);
                expect(system.isTechnical, 'Подготовлена обычная ДС').toBe(false);
                await use(system);
            } finally {
                await test.step('Очистка подготовленной ДС с учётом переименования', async () => {
                    const systemId = createdId;
                    if (!systemId) return;
                    await test.step('Подтвердить завершение UI-мутации перед удалением ДС', () =>
                        pendingMutation.waitBeforeCleanup(systemId));
                    await systemsApi.requireOwner();
                    const current = await systemsApi.get(systemId);
                    if (current) {
                        expect(current, 'Подтверждённый ID остаётся обычной ДС своего проекта').toMatchObject({
                            id: systemId,
                            projectId: systemsApi.projectId,
                            isTechnical: false,
                        });
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
