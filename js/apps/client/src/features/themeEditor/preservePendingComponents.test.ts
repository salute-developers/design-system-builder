import { afterEach, expect, it } from 'vitest';
import { Config } from '../../controllers/componentBuilder/config';
import { setDraftAutosaveActivity } from '../../api/draftAutosaveActivity';
import { buttonMeta } from '../../composePreview/nestedStyleFixture';
import { keepUnchangedComponents } from './keepLoadedComponents';
import { preservePendingComponents } from './preservePendingComponents';

const context = { projectId: 'pending-components', designSystemId: 'ds', tenantId: 'theme' };
const component = (name: string, platform: 'web' | 'compose' = 'web') =>
    new Config({ name, platform, description: '', sources: { api: [], configs: [], variations: [] } });

afterEach(() => {
    for (const route of ['A', 'compose-A']) setDraftAutosaveActivity(context, `component:${route}`, null);
});

it.each(['pending', 'saving', 'error'] as const)(
    'сохраняет экземпляр A при A %s → B → A, включая скрытые конфигурации',
    (status) => {
        const local = component('A');
        setDraftAutosaveActivity(context, 'component:A', status);
        const openedB = preservePendingComponents(context, [local], [component('A'), component('B')]);
        expect(openedB.find((item) => item.getName() === 'A')).toBe(local);
        const returnedA = preservePendingComponents(context, openedB, [component('A'), component('B')]);
        expect(returnedA.find((item) => item.getName() === 'A')).toBe(local);
        setDraftAutosaveActivity(context, 'component:A', 'saved');
        const confirmed = component('A');
        expect(preservePendingComponents(context, returnedA, [confirmed])).toEqual([confirmed]);
    },
);

it('не путает платформы и удерживает неподтверждённую конфигурацию, отсутствующую в новом индексе', () => {
    const local = component('A', 'compose');
    const web = component('A');
    setDraftAutosaveActivity(context, 'component:compose-A', 'error');
    expect(preservePendingComponents(context, [local], [web])).toEqual([web, local]);
});

it('reads a new Core model while an older configuration retains its own recovery head', () => {
    const local = new Config({
        ...structuredClone(buttonMeta()),
        name: 'A',
        platform: 'web',
        serverBinding: { componentId: 'a', appearanceId: '', coreReleaseId: 'same', coreSelectionRevision: 1 },
    });
    const server = new Config({
        ...structuredClone(buttonMeta()),
        name: 'A',
        platform: 'web',
        serverBinding: { componentId: 'a', appearanceId: '', coreReleaseId: 'same', coreSelectionRevision: 2 },
    });
    setDraftAutosaveActivity(context, 'component:A', 'error');
    expect(local.getConfigurations().length).toBeGreaterThan(0);
    expect(server.getMeta()).toEqual(local.getMeta());
    const merged = keepUnchangedComponents([local], [server]);
    const result = preservePendingComponents(context, [local], merged);
    expect(result[0]).toBe(server);
    expect(result[0].getCoreSelectionRevision()).toBe(2);
});
