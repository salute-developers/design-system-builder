import { describe, expect, it, vi } from 'vitest';
import { authService } from './authService';

import {
    hasPersistedComponentMutation,
    reloadWhenDraftAutosaveIsIdle,
    setDraftAutosaveActivity,
    waitForDraftAutosaveIdle,
    getDraftAutosaveRevision,
    registerDraftAutosaveSource,
    getDraftAutosaveSourceStatus,
} from './draftAutosaveActivity';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };

describe('draft autosave activity', () => {
    it('передаёт ошибку восстановленной очереди, не освобождая ещё работающий старый запрос', () => {
        const old = registerDraftAutosaveSource(context, 'component:web/Button');
        old('saving');
        old.detach();
        const current = registerDraftAutosaveSource(context, 'component:web/Button');
        current('saving');
        current.adoptFailed();
        current('saved');
        current(null);
        expect(getDraftAutosaveSourceStatus(context, 'component:web/Button')).toBe('saving');
        old('error'); // Ответ старого запроса пришёл после успешного восстановления.
        expect(getDraftAutosaveSourceStatus(context, 'component:web/Button')).toBe('saved');
    });
    it('игнорирует владельца старой авторизации после сброса сессии', async () => {
        localStorage.clear();
        const old = registerDraftAutosaveSource(context, 'component:web/Button');
        old('saving');
        await authService.logout();
        const current = registerDraftAutosaveSource(context, 'component:web/Button');
        current('pending');
        old(null);
        old('saved');
        expect(getDraftAutosaveSourceStatus(context, 'component:web/Button')).toBe('pending');
        current(null);
    });
    it('сохраняет активность новой очереди при завершении и удалении старого владельца', async () => {
        const old = registerDraftAutosaveSource(context, 'component:web/Button');
        const current = registerDraftAutosaveSource(context, 'component:web/Button');
        old('saving');
        current('pending');
        const reload = vi.fn();
        reloadWhenDraftAutosaveIsIdle(context, reload);
        old('saved');
        old(null);
        old('saved'); // Поздний callback освобождённой очереди не восстанавливает её регистрацию.
        expect(getDraftAutosaveSourceStatus(context, 'component:web/Button')).toBe('pending');
        expect(reload).not.toHaveBeenCalled();
        current('saved');
        expect(reload).toHaveBeenCalledOnce();
        current(null);
        expect(getDraftAutosaveSourceStatus(context, 'component:web/Button')).toBe('saved');
    });
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
