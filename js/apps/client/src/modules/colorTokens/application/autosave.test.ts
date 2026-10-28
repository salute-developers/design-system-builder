import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createColorTokenAutosave, type PendingUpdate } from './autosave';
import { ColorTokenOperationError, type ColorTokenRepository } from './colorTokenRepository';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 't' };
const payload = (tokenId: string, value: string): PendingUpdate => ({
    tokenId,
    update: { members: [{ tokenId, values: [{ platform: 'web', mode: 'light', paletteId: null, value: [value] }] }] },
});

const setup = (updateValues: ColorTokenRepository['updateValues']) => {
    let revision = 1;
    const onConflict = vi.fn();
    const repository: ColorTokenRepository = {
        create: vi.fn(async (_c, _i, editRevision) => ({
            editRevision: editRevision + 1,
            value: { type: 'color' as const, group: 'text', name: 'x', members: [] },
        })),
        updateValues: vi.fn(updateValues),
        delete: vi.fn(async (_c, _t, editRevision) => ({ editRevision: editRevision + 1 })),
    };
    const autosave = createColorTokenAutosave({
        repository,
        context,
        revision: { get: () => revision, set: (value) => (revision = value) },
        onConflict,
    });
    return { autosave, repository, onConflict, revision: () => revision };
};

describe('автосохранение цветовых токенов', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('объединяет правки одного токена и отправляет последнее значение через паузу', async () => {
        const { autosave, repository } = setup(async (_c, _t, _u, editRevision) => ({
            editRevision: editRevision + 1,
        }));
        autosave.schedule('a', () => payload('a', '#111'));
        await vi.advanceTimersByTimeAsync(200);
        autosave.schedule('a', () => payload('a', '#222'));
        expect(autosave.status('a').state).toBe('pending');
        await vi.advanceTimersByTimeAsync(399);
        expect(repository.updateValues).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await autosave.flush();
        expect(repository.updateValues).toHaveBeenCalledTimes(1);
        expect(vi.mocked(repository.updateValues).mock.calls[0][2]).toEqual(payload('a', '#222').update);
        expect(autosave.status('a').state).toBe('saved');
        expect(autosave.hasUnsaved()).toBe(false);
    });

    it('отправляет токены по одному с цепочкой ревизий', async () => {
        const revisions: number[] = [];
        const { autosave, revision } = setup(async (_c, _t, _u, editRevision) => {
            revisions.push(editRevision);
            return { editRevision: editRevision + 1 };
        });
        autosave.schedule('a', () => payload('a', '#111'));
        autosave.schedule('b', () => payload('b', '#222'));
        await autosave.flush();
        expect(revisions).toEqual([1, 2]);
        expect(revision()).toBe(3);
    });

    it('сохраняет ввод при ошибке и отправляет его снова по «Повторить»', async () => {
        let fail = true;
        const { autosave, repository } = setup(async (_c, _t, _u, editRevision) => {
            if (fail) throw new ColorTokenOperationError('network', 'Сервис недоступен');
            return { editRevision: editRevision + 1 };
        });
        autosave.schedule('a', () => payload('a', '#333'));
        await autosave.flush();
        expect(autosave.status('a')).toMatchObject({ state: 'error' });
        expect(autosave.overall().error?.message).toBe('Сервис недоступен');
        expect(autosave.unsavedKeys()).toEqual(['a']);
        fail = false;
        autosave.retry('a');
        await autosave.flush();
        expect(autosave.status('a').state).toBe('saved');
        expect(vi.mocked(repository.updateValues).mock.calls[1][2]).toEqual(payload('a', '#333').update);
    });

    it('после конфликта останавливает очередь до действия пользователя', async () => {
        const conflict = new ColorTokenOperationError('conflict', 'Тема изменена', 'TENANT_EDIT_CONFLICT', null, 7);
        let reject = true;
        const { autosave, repository, onConflict } = setup(async (_c, _t, _u, editRevision) => {
            if (reject) throw conflict;
            return { editRevision: editRevision + 1 };
        });
        autosave.schedule('a', () => payload('a', '#111'));
        autosave.schedule('b', () => payload('b', '#222'));
        await autosave.flush();
        expect(onConflict).toHaveBeenCalledWith(conflict);
        expect(repository.updateValues).toHaveBeenCalledTimes(1);
        expect(autosave.status('a').state).toBe('error');
        expect(autosave.status('b').state).toBe('pending');
        reject = false;
        autosave.retry();
        await autosave.flush();
        expect(repository.updateValues).toHaveBeenCalledTimes(3);
        expect(autosave.hasUnsaved()).toBe(false);
    });

    it('показывает адрес недопустимого значения', async () => {
        const { autosave } = setup(async () => {
            throw new ColorTokenOperationError('invalid', 'Нет ступени', 'INVALID_TOKEN_VALUE', 'id:web:dark');
        });
        autosave.schedule('a', () => payload('a', '[general.x.1]'));
        await autosave.flush();
        expect(autosave.status('a').error).toMatchObject({ code: 'INVALID_TOKEN_VALUE', address: 'id:web:dark' });
    });

    it('правка во время отправки остаётся несохранённой', async () => {
        let resolve: (value: { editRevision: number }) => void = () => undefined;
        const { autosave } = setup(() => new Promise((done) => (resolve = done)));
        autosave.schedule('a', () => payload('a', '#111'));
        void autosave.flush();
        await vi.advanceTimersByTimeAsync(0);
        expect(autosave.status('a').state).toBe('saving');
        autosave.schedule('a', () => payload('a', '#222'));
        resolve({ editRevision: 2 });
        await vi.advanceTimersByTimeAsync(0);
        expect(autosave.status('a').state).toBe('pending');
    });

    it('выполняет создание после очереди и обновляет ревизию', async () => {
        const order: string[] = [];
        const { autosave, revision } = setup(async (_c, tokenId, _u, editRevision) => {
            order.push(`update:${tokenId}`);
            return { editRevision: editRevision + 1 };
        });
        autosave.schedule('a', () => payload('a', '#111'));
        const created = await autosave.run(async (editRevision) => {
            order.push(`create:${editRevision}`);
            return { editRevision: editRevision + 1, value: 'ok' };
        });
        expect(created).toBe('ok');
        expect(order).toEqual(['update:a', 'create:2']);
        expect(revision()).toBe(3);
    });

    it('забывает удалённый токен вместе с ошибкой', async () => {
        const { autosave } = setup(async () => {
            throw new ColorTokenOperationError('network', 'offline');
        });
        autosave.schedule('a', () => payload('a', '#111'));
        await vi.advanceTimersByTimeAsync(400);
        await autosave.flush();
        expect(autosave.status('a').state).toBe('error');
        autosave.forget('a');
        expect(autosave.hasUnsaved()).toBe(false);
        expect(autosave.overall().state).toBe('saved');
    });

    it('подтверждает снимок отправленных значений, не изменившийся объект редактора', async () => {
        let finish!: (value: { editRevision: number }) => void;
        const onConfirmed = vi.fn();
        const first = payload('a', '#111');
        const repository = {
            updateValues: vi.fn(
                () =>
                    new Promise((resolve) => {
                        finish = resolve;
                    }),
            ),
        } as unknown as ColorTokenRepository;
        const autosave = createColorTokenAutosave({
            repository,
            context,
            revision: { get: () => 0, set: vi.fn() },
            onConfirmed,
        });
        autosave.schedule('a', () => first);
        const waiting = autosave.flush();
        await vi.advanceTimersByTimeAsync(0);
        (first.update.members[0].values[0].value as string[])[0] = '#222';
        autosave.schedule('a', () => first);
        finish({ editRevision: 1 });
        await waiting;
        expect(onConfirmed).toHaveBeenCalledWith(payload('a', '#111'), { editRevision: 1 });
        expect(autosave.status('a').state).toBe('pending');
        autosave.dispose();
    });
});
