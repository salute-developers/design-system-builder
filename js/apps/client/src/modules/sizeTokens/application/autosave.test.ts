import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DimensionToken } from '../domain';
import { createSizeTokenAutosave, type PendingUpdate } from './autosave';
import { SizeTokenOperationError, type SizeTokenRepository, type UpdatedSizeToken } from './sizeTokenRepository';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 't' };
const payload = (tokenId: string, valuePx: number): PendingUpdate => ({
    tokenId,
    value: { kind: 'dimension', valuePx, platforms: {} },
});
const token = (tokenId: string, valuePx: number): DimensionToken => ({
    kind: 'radius',
    tokenId,
    name: `round.${tokenId}`,
    valuePx,
    fullRounding: false,
    platforms: {},
    native: { ios: valuePx, android: valuePx },
    platformsDiffer: false,
    components: [],
    derived: [],
});
const updated = (tokenId: string, valuePx: number, editRevision: number): UpdatedSizeToken => ({
    editRevision,
    token: token(tokenId, valuePx),
    values: [],
});

const setup = (updateValue: SizeTokenRepository['updateValue']) => {
    let revision = 1;
    const onConflict = vi.fn();
    const onSaved = vi.fn();
    const repository = { updateValue: vi.fn(updateValue) };
    const autosave = createSizeTokenAutosave({
        repository,
        context,
        revision: { get: () => revision, set: (value) => (revision = value) },
        onConflict,
        onSaved,
    });
    return { autosave, repository, onConflict, onSaved, revision: () => revision };
};

describe('автосохранение токенов размеров', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('объединяет правки одного токена и отправляет последнее значение через 400 мс', async () => {
        const { autosave, repository, onSaved } = setup(async (_c, tokenId, value, editRevision) =>
            updated(tokenId, value.kind === 'dimension' ? value.valuePx : 0, editRevision + 1),
        );
        autosave.schedule('a', () => payload('a', 10));
        await vi.advanceTimersByTimeAsync(200);
        autosave.schedule('a', () => payload('a', 14));
        expect(autosave.status('a').state).toBe('pending');
        await vi.advanceTimersByTimeAsync(399);
        expect(repository.updateValue).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await autosave.flush();
        expect(repository.updateValue).toHaveBeenCalledTimes(1);
        expect(repository.updateValue.mock.calls[0][2]).toEqual(payload('a', 14).value);
        expect(autosave.status('a').state).toBe('saved');
        expect(onSaved).toHaveBeenCalledWith('a', expect.objectContaining({ editRevision: 2 }), true);
    });

    it('отправляет токены по одному с ревизией предыдущей операции', async () => {
        const revisions: number[] = [];
        const { autosave, revision } = setup(async (_c, tokenId, _v, editRevision) => {
            revisions.push(editRevision);
            return updated(tokenId, 1, editRevision + 1);
        });
        autosave.schedule('a', () => payload('a', 1));
        autosave.schedule('b', () => payload('b', 2));
        await autosave.flush();
        expect(revisions).toEqual([1, 2]);
        expect(revision()).toBe(3);
    });

    it('сохраняет ввод при ошибке сети и отправляет его снова по «Повторить»', async () => {
        let fail = true;
        const { autosave, repository } = setup(async (_c, tokenId, _v, editRevision) => {
            if (fail) throw new SizeTokenOperationError('network', 'Сервис недоступен');
            return updated(tokenId, 1, editRevision + 1);
        });
        autosave.schedule('a', () => payload('a', 3));
        await autosave.flush();
        expect(autosave.status('a')).toMatchObject({ state: 'error' });
        expect(autosave.overall().error?.message).toBe('Сервис недоступен');
        fail = false;
        autosave.retry('a');
        await autosave.flush();
        expect(autosave.status('a').state).toBe('saved');
        expect(repository.updateValue).toHaveBeenCalledTimes(2);
    });

    it('после конфликта останавливает очередь до действия пользователя', async () => {
        const conflict = new SizeTokenOperationError('conflict', 'Тема изменена', 'TENANT_EDIT_CONFLICT', null, 7);
        let reject = true;
        const { autosave, repository, onConflict } = setup(async (_c, tokenId, _v, editRevision) => {
            if (reject) throw conflict;
            return updated(tokenId, 1, editRevision + 1);
        });
        autosave.schedule('a', () => payload('a', 1));
        autosave.schedule('b', () => payload('b', 2));
        await autosave.flush();
        expect(onConflict).toHaveBeenCalledWith(conflict);
        expect(repository.updateValue).toHaveBeenCalledTimes(1);
        expect(autosave.status('b').state).toBe('pending');
        reject = false;
        autosave.retry();
        await autosave.flush();
        expect(repository.updateValue).toHaveBeenCalledTimes(3);
        expect(autosave.hasUnsaved()).toBe(false);
    });

    it('передаёт поле недопустимого значения', async () => {
        const { autosave } = setup(async () => {
            throw new SizeTokenOperationError(
                'invalid',
                'Значение должно быть в диапазоне 0–1000 px.',
                'INVALID_SIZE_VALUE',
                'valuePx',
            );
        });
        autosave.schedule('a', () => payload('a', 1200));
        await autosave.flush();
        expect(autosave.status('a').error).toMatchObject({ code: 'INVALID_SIZE_VALUE', field: 'valuePx' });
    });

    it('правка во время отправки остаётся несохранённой, а ответ отмечается устаревшим', async () => {
        let resolve: (value: UpdatedSizeToken) => void = () => undefined;
        const { autosave, onSaved } = setup(() => new Promise((done) => (resolve = done)));
        autosave.schedule('a', () => payload('a', 1));
        void autosave.flush();
        await vi.advanceTimersByTimeAsync(0);
        expect(autosave.status('a').state).toBe('saving');
        autosave.schedule('a', () => payload('a', 2));
        resolve(updated('a', 1, 2));
        await vi.advanceTimersByTimeAsync(0);
        expect(autosave.status('a').state).toBe('pending');
        expect(onSaved).toHaveBeenCalledWith('a', expect.anything(), false);
    });

    it('выполняет создание и удаление после очереди', async () => {
        const order: string[] = [];
        const { autosave, revision } = setup(async (_c, tokenId, _v, editRevision) => {
            order.push(`update:${tokenId}`);
            return updated(tokenId, 1, editRevision + 1);
        });
        autosave.schedule('a', () => payload('a', 1));
        const created = await autosave.run(async (editRevision) => {
            order.push(`create:${editRevision}`);
            return { editRevision: editRevision + 1, value: 'ok' };
        });
        expect(created).toBe('ok');
        expect(order).toEqual(['update:a', 'create:2']);
        expect(revision()).toBe(3);
    });
});
