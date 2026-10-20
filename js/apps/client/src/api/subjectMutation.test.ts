import { describe, expect, it, vi } from 'vitest';

import {
    getDraftAutosaveStatus,
    isDraftAutosaveIdle,
    subscribeDraftAutosaveStatus,
    waitForDraftAutosaveIdle,
    setDraftAutosaveActivity,
    reloadWhenDraftAutosaveIsIdle,
} from './draftAutosaveActivity';
import { subjectMutation } from './subjectMutation';

vi.mock('./editorReads', () => ({ invalidateEditorReads: vi.fn() }));

describe('предметные операции и общий статус', () => {
    it('ожидает все параллельные запросы и освобождает активность после их завершения', async () => {
        const context = { projectId: 'subject', designSystemId: 'parallel', tenantId: 'theme' };
        let finish!: () => void;
        let fail!: (reason: Error) => void;
        const success = subjectMutation(
            context,
            () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        );
        const failure = subjectMutation(
            context,
            () =>
                new Promise<void>((_resolve, reject) => {
                    fail = reject;
                }),
        );
        const rejected = expect(failure).rejects.toThrow('offline');
        fail(new Error('offline'));
        await rejected;
        expect(isDraftAutosaveIdle(context)).toBe(false);
        finish();
        await success;
        expect(getDraftAutosaveStatus(context)).toBe('saved');
        expect(isDraftAutosaveIdle(context)).toBe(true);
    });

    it('оставляет время последнего успешного сохранения при неудаче', async () => {
        const context = { projectId: 'subject', designSystemId: 'timestamp', tenantId: 'theme' };
        const listener = vi.fn();
        const unsubscribe = subscribeDraftAutosaveStatus(context, listener);
        await subjectMutation(context, async () => undefined);
        const lastSaved = listener.mock.calls.at(-1)?.[1];
        expect(lastSaved).toEqual(expect.any(Number));
        await expect(
            subjectMutation(context, async () => {
                throw new Error('offline');
            }),
        ).rejects.toThrow('offline');
        expect(listener).toHaveBeenLastCalledWith('saved', lastSaved);
        unsubscribe();
    });

    it('после отклонённой команды 409 выпускает SSE и публикацию без новой мутации', async () => {
        const context = { projectId: 'subject', designSystemId: 'rejected', tenantId: 'theme' };
        const refresh = vi.fn();
        await expect(
            subjectMutation(context, async () => {
                reloadWhenDraftAutosaveIsIdle(context, refresh);
                throw Object.assign(new Error('Имя группы занято'), { response: { status: 409 } });
            }),
        ).rejects.toThrow('Имя группы занято');
        await expect(waitForDraftAutosaveIdle(context, 100)).resolves.toBeUndefined();
        expect(refresh).toHaveBeenCalledOnce();
        expect(isDraftAutosaveIdle(context)).toBe(true);
    });

    it('завершённая команда не скрывает ошибку настоящей очереди неподтверждённых правок', async () => {
        const context = { projectId: 'subject', designSystemId: 'queue', tenantId: 'theme' };
        setDraftAutosaveActivity(context, 'color-tokens', 'error');
        await expect(
            subjectMutation(context, async () => {
                throw new Error('offline');
            }),
        ).rejects.toThrow('offline');
        expect(getDraftAutosaveStatus(context)).toBe('error');
        expect(isDraftAutosaveIdle(context)).toBe(false);
        setDraftAutosaveActivity(context, 'color-tokens', null);
    });

    it('не выполняет операцию над опубликованной версией', async () => {
        const operation = vi.fn();
        await expect(
            subjectMutation({ projectId: 'p', designSystemId: 's', tenantId: 't', versionId: 'v' }, operation),
        ).rejects.toThrow('только для чтения');
        expect(operation).not.toHaveBeenCalled();
    });
});
