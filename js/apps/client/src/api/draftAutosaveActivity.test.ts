import { describe, expect, it, vi } from 'vitest';

import {
    hasPersistedComponentMutation,
    reloadWhenDraftAutosaveIsIdle,
    setDraftAutosaveActivity,
    waitForDraftAutosaveIdle,
    getDraftAutosaveRevision,
} from './draftAutosaveActivity';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };

describe('draft autosave activity', () => {
    it('помнит запись, которая началась и закончилась за время чтения даже без постоянной очереди', () => {
        const isolated = { projectId: 'transient', designSystemId: 's', tenantId: 't' };
        const before = getDraftAutosaveRevision(isolated);
        setDraftAutosaveActivity(isolated, 'request', 'saving');
        setDraftAutosaveActivity(isolated, 'request', null);
        expect(getDraftAutosaveRevision(isolated)).not.toBe(before);
    });
    it('находит ожидающее изменение компонента после перезагрузки', () => {
        localStorage.setItem('ds_pending_component:project-1:ds-1:tenant-1:Button:request', '{"generation":"g-1"}');

        expect(hasPersistedComponentMutation(context)).toBe(true);
        localStorage.clear();
        expect(hasPersistedComponentMutation(context)).toBe(false);
    });
    it('defers remote reload until every local queue is saved', () => {
        const reload = vi.fn();
        setDraftAutosaveActivity(context, 'tokens', 'saving');
        setDraftAutosaveActivity(context, 'component:Button', 'pending');

        reloadWhenDraftAutosaveIsIdle(context, reload);
        setDraftAutosaveActivity(context, 'tokens', 'saved');
        expect(reload).not.toHaveBeenCalled();
        setDraftAutosaveActivity(context, 'component:Button', 'saved');

        expect(reload).toHaveBeenCalledTimes(1);
        setDraftAutosaveActivity(context, 'tokens', null);
        setDraftAutosaveActivity(context, 'component:Button', null);
    });

    it('waits for in-memory queues without reading browser storage', async () => {
        setDraftAutosaveActivity(context, 'tokens', 'pending');
        const storageRead = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });
        const waiting = waitForDraftAutosaveIdle(context, 1_000);

        setDraftAutosaveActivity(context, 'tokens', 'saved');
        await expect(waiting).resolves.toBeUndefined();
        expect(storageRead).not.toHaveBeenCalled();
        setDraftAutosaveActivity(context, 'tokens', null);
        storageRead.mockRestore();
    });
});
