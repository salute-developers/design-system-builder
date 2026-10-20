import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bodyM, updated } from '../testFixtures';
import { createTypographyAutosave } from './autosave';
import { TypographyOperationError, type TypographyStyleRepository } from './typographyStyleRepository';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 't' };

const setup = (update: TypographyStyleRepository['update']) => {
    let revision = 1;
    const onConflict = vi.fn();
    const onRejected = vi.fn();
    const onSaved = vi.fn();
    const repository: TypographyStyleRepository = { load: vi.fn(), update: vi.fn(update) };
    const autosave = createTypographyAutosave({
        repository,
        context,
        revision: { get: () => revision, set: (value) => (revision = value) },
        onConflict,
        onRejected,
        onSaved,
    });
    return { autosave, repository, onConflict, onRejected, onSaved, revision: () => revision };
};

const ok: TypographyStyleRepository['update'] = async (_c, _t, _change, editRevision) =>
    updated(bodyM('screen-l'), editRevision + 1);

describe('автосохранение стилей типографии', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('объединяет правки одного стиля и отправляет одну операцию через 400 мс', async () => {
        const { autosave, repository, onSaved } = setup(ok);
        autosave.schedule('screen-l|body.m', 'tok', { size: 17 });
        await vi.advanceTimersByTimeAsync(200);
        autosave.schedule('screen-l|body.m', 'tok', { size: 18, weights: { bold: 700 } });
        expect(autosave.overall().state).toBe('pending');
        expect(autosave.pending('screen-l|body.m')).toEqual({ size: 18, weights: { bold: 700 } });
        await vi.advanceTimersByTimeAsync(399);
        expect(repository.update).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await autosave.flush();
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(vi.mocked(repository.update).mock.calls[0].slice(1)).toEqual([
            'tok',
            { size: 18, weights: { bold: 700 } },
            1,
        ]);
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(autosave.overall().state).toBe('saved');
        expect(autosave.hasUnsaved()).toBe(false);
    });

    it('отправляет стили по одному с ревизией предыдущей операции', async () => {
        const revisions: number[] = [];
        const { autosave, revision } = setup(async (_c, _t, _change, editRevision) => {
            revisions.push(editRevision);
            return updated(bodyM('screen-l'), editRevision + 1);
        });
        autosave.schedule('screen-l|body.m', 'a', { size: 18 });
        autosave.schedule('screen-m|body.m', 'b', { size: 17 });
        await autosave.flush();
        expect(revisions).toEqual([1, 2]);
        expect(revision()).toBe(3);
    });

    it('при ошибке сети оставляет правку и отправляет её снова по «Повторить»', async () => {
        let fail = true;
        const { autosave, repository } = setup(async (context, tokenId, change, editRevision) => {
            if (fail) throw new TypographyOperationError('network', 'Сервис недоступен');
            return ok(context, tokenId, change, editRevision);
        });
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 });
        await autosave.flush();
        expect(autosave.overall()).toMatchObject({ state: 'error', error: { kind: 'network' } });
        expect(autosave.pending('screen-l|body.m')).toEqual({ size: 18 });
        fail = false;
        autosave.retry();
        await autosave.flush();
        expect(repository.update).toHaveBeenCalledTimes(2);
        expect(autosave.overall().state).toBe('saved');
    });

    it('снимает отклонённое значение с очереди и сообщает поле', async () => {
        const { autosave, onRejected } = setup(async () => {
            throw new TypographyOperationError('invalid', 'Размер…', 'INVALID_TYPOGRAPHY_VALUE', 'size');
        });
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 });
        await autosave.flush();
        expect(onRejected).toHaveBeenCalledWith('screen-l|body.m', expect.objectContaining({ field: 'size' }));
        expect(autosave.hasUnsaved()).toBe(false);
        expect(autosave.overall().state).toBe('saved');
    });

    it('после конфликта ревизии не отправляет правки без «Повторить»', async () => {
        let conflict = true;
        const { autosave, repository, onConflict } = setup(async (context, tokenId, change, editRevision) => {
            if (conflict) throw new TypographyOperationError('conflict', 'Конфликт', 'TENANT_EDIT_CONFLICT', null, 7);
            return ok(context, tokenId, change, editRevision);
        });
        autosave.schedule('screen-l|body.m', 'a', { size: 18 });
        await autosave.flush();
        expect(onConflict).toHaveBeenCalledTimes(1);
        autosave.schedule('screen-m|body.m', 'b', { size: 17 });
        await autosave.flush();
        expect(repository.update).toHaveBeenCalledTimes(1);
        conflict = false;
        autosave.retry();
        await autosave.flush();
        expect(repository.update).toHaveBeenCalledTimes(3);
        expect(autosave.hasUnsaved()).toBe(false);
    });

    it('правка, сделанная во время отправки, остаётся в очереди без отправленных частей', async () => {
        let release = () => undefined as void;
        const { autosave, repository } = setup(
            (context, tokenId, change, editRevision) =>
                new Promise((resolve) => {
                    release = () => resolve(ok(context, tokenId, change, editRevision));
                }),
        );
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 });
        void autosave.flush();
        await vi.advanceTimersByTimeAsync(0);
        autosave.schedule('screen-l|body.m', 'tok', { lineHeight: 24 });
        release();
        await vi.advanceTimersByTimeAsync(0);
        expect(autosave.pending('screen-l|body.m')).toEqual({ lineHeight: 24 });
        await vi.advanceTimersByTimeAsync(400);
        release();
        await autosave.flush();
        expect(vi.mocked(repository.update).mock.calls[1][2]).toEqual({ lineHeight: 24 });
    });

    it('не отправляет правку, которая после отправки ничего не меняет', async () => {
        let release = () => undefined as void;
        const { autosave, repository } = setup(
            (context, tokenId, change, editRevision) =>
                new Promise((resolve) => {
                    release = () => resolve(ok(context, tokenId, change, editRevision));
                }),
        );
        autosave.schedule('screen-l|body.m', 'tok', { weights: { bold: 700 } });
        void autosave.flush();
        await vi.advanceTimersByTimeAsync(0);
        autosave.schedule('screen-l|body.m', 'tok', { weights: { bold: 600 } });
        autosave.schedule('screen-l|body.m', 'tok', { weights: { bold: 700 } });
        release();
        await vi.advanceTimersByTimeAsync(400);
        await autosave.flush();
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(autosave.hasUnsaved()).toBe(false);
    });

    it('ошибка сети старой отправки не останавливает новую правку', async () => {
        let fail = true;
        let release = () => undefined as void;
        const { autosave, repository } = setup(
            (context, tokenId, change, editRevision) =>
                new Promise((resolve, reject) => {
                    release = () =>
                        fail
                            ? reject(new TypographyOperationError('network', 'Сервис недоступен'))
                            : resolve(ok(context, tokenId, change, editRevision));
                }),
        );
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 });
        void autosave.flush();
        await vi.advanceTimersByTimeAsync(0);
        autosave.schedule('screen-l|body.m', 'tok', { size: 19 });
        release();
        await vi.advanceTimersByTimeAsync(0);
        expect(autosave.overall().state).toBe('pending');
        fail = false;
        await vi.advanceTimersByTimeAsync(400);
        release();
        await autosave.flush();
        expect(vi.mocked(repository.update).mock.calls[1][2]).toEqual({ size: 19 });
        expect(autosave.hasUnsaved()).toBe(false);
    });
});
