import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bodyM, updated } from '../testFixtures';
import { createTypographyAutosave } from './autosave';
import { TypographyOperationError, type TypographyStyleRepository } from './typographyStyleRepository';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 't' };
const values = [{ tokenId: 'tok', platform: 'web' as const }];

const setup = (update: TypographyStyleRepository['update']) => {
    const onRejected = vi.fn();
    const onSaved = vi.fn();
    const repository: TypographyStyleRepository = { load: vi.fn(), update: vi.fn(update) };
    const autosave = createTypographyAutosave({ repository, context, onRejected, onSaved });
    return { autosave, repository, onRejected, onSaved };
};

const ok: TypographyStyleRepository['update'] = async () => updated(bodyM('screen-l'));

const network = () => new TypographyOperationError('network', 'Сервис недоступен');

describe('автосохранение стилей типографии', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('объединяет правки одного стиля и отправляет одну операцию через 400 мс со значениями стиля', async () => {
        const { autosave, repository, onSaved } = setup(ok);
        autosave.schedule('screen-l|body.m', 'tok', { size: 17 }, values);
        await vi.advanceTimersByTimeAsync(200);
        autosave.schedule('screen-l|body.m', 'tok', { size: 18, weights: { bold: 700 } }, values);
        expect(autosave.overall().state).toBe('pending');
        expect(autosave.pending('screen-l|body.m')).toEqual({ size: 18, weights: { bold: 700 } });
        await vi.advanceTimersByTimeAsync(399);
        expect(repository.update).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await autosave.flush();
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(vi.mocked(repository.update).mock.calls[0]).toEqual([
            context,
            'tok',
            { size: 18, weights: { bold: 700 } },
            values,
        ]);
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(autosave.overall().state).toBe('saved');
        expect(autosave.hasUnsaved()).toBe(false);
    });

    it('отправляет стили по одному', async () => {
        let active = 0;
        let maximum = 0;
        const { autosave, repository } = setup(async () => {
            active += 1;
            maximum = Math.max(maximum, active);
            await Promise.resolve();
            active -= 1;
            return updated(bodyM('screen-l'));
        });
        autosave.schedule('screen-l|body.m', 'a', { size: 18 }, values);
        autosave.schedule('screen-m|body.m', 'b', { size: 17 }, values);
        await autosave.flush();
        expect(repository.update).toHaveBeenCalledTimes(2);
        expect(maximum).toBe(1);
    });

    it('при ошибке сети повторяет правку автоматически с растущей задержкой', async () => {
        let failures = 2;
        const { autosave, repository } = setup(async (...args) => {
            if (failures-- > 0) throw network();
            return ok(...args);
        });
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 }, values);
        await vi.advanceTimersByTimeAsync(400);
        expect(autosave.overall()).toMatchObject({ state: 'error', error: { kind: 'network' } });
        expect(autosave.pending('screen-l|body.m')).toEqual({ size: 18 });
        await vi.advanceTimersByTimeAsync(999);
        expect(repository.update).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(repository.update).toHaveBeenCalledTimes(2);
        expect(autosave.overall().state).toBe('error');
        await vi.advanceTimersByTimeAsync(1_999);
        expect(repository.update).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(repository.update).toHaveBeenCalledTimes(3);
        expect(autosave.overall().state).toBe('saved');
    });

    it('задержка повтора не превышает 30 секунд, а «Повторить» отправляет сразу', async () => {
        let fail = true;
        const { autosave, repository } = setup(async (...args) => {
            if (fail) throw new TypographyOperationError('network', 'Ошибка API (503)');
            return ok(...args);
        });
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 }, values);
        await vi.advanceTimersByTimeAsync(400);
        for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000]) await vi.advanceTimersByTimeAsync(delay);
        expect(repository.update).toHaveBeenCalledTimes(7);
        await vi.advanceTimersByTimeAsync(29_999);
        expect(repository.update).toHaveBeenCalledTimes(7);
        await vi.advanceTimersByTimeAsync(1);
        expect(repository.update).toHaveBeenCalledTimes(8);
        fail = false;
        autosave.retry();
        await autosave.flush();
        expect(repository.update).toHaveBeenCalledTimes(9);
        expect(autosave.overall().state).toBe('saved');
        await vi.advanceTimersByTimeAsync(60_000);
        expect(repository.update).toHaveBeenCalledTimes(9);
    });

    it('отказ без повтора ждёт «Повторить»', async () => {
        let fail = true;
        const { autosave, repository } = setup(async (...args) => {
            if (fail) throw new TypographyOperationError('forbidden', 'Нет прав');
            return ok(...args);
        });
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 }, values);
        await vi.advanceTimersByTimeAsync(400);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(repository.update).toHaveBeenCalledTimes(1);
        expect(autosave.overall()).toMatchObject({ state: 'error', error: { kind: 'forbidden' } });
        fail = false;
        autosave.retry();
        await autosave.flush();
        expect(repository.update).toHaveBeenCalledTimes(2);
        expect(autosave.hasUnsaved()).toBe(false);
    });

    it('снимает отклонённое значение с очереди и сообщает поле', async () => {
        const { autosave, onRejected } = setup(async () => {
            throw new TypographyOperationError('invalid', 'Размер…', 'INVALID_TYPOGRAPHY_VALUE', 'size');
        });
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 }, values);
        await autosave.flush();
        expect(onRejected).toHaveBeenCalledWith('screen-l|body.m', expect.objectContaining({ field: 'size' }));
        expect(autosave.hasUnsaved()).toBe(false);
        expect(autosave.overall().state).toBe('saved');
    });

    it('правка, сделанная во время отправки, остаётся в очереди без отправленных частей', async () => {
        let release = () => undefined as void;
        const { autosave, repository } = setup(
            (...args) =>
                new Promise((resolve) => {
                    release = () => resolve(ok(...args));
                }),
        );
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 }, values);
        void autosave.flush();
        await vi.advanceTimersByTimeAsync(0);
        autosave.schedule('screen-l|body.m', 'tok', { lineHeight: 24 }, values);
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
            (...args) =>
                new Promise((resolve) => {
                    release = () => resolve(ok(...args));
                }),
        );
        autosave.schedule('screen-l|body.m', 'tok', { weights: { bold: 700 } }, values);
        void autosave.flush();
        await vi.advanceTimersByTimeAsync(0);
        autosave.schedule('screen-l|body.m', 'tok', { weights: { bold: 600 } }, values);
        autosave.schedule('screen-l|body.m', 'tok', { weights: { bold: 700 } }, values);
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
            (...args) =>
                new Promise((resolve, reject) => {
                    release = () => (fail ? reject(network()) : resolve(ok(...args)));
                }),
        );
        autosave.schedule('screen-l|body.m', 'tok', { size: 18 }, values);
        void autosave.flush();
        await vi.advanceTimersByTimeAsync(0);
        autosave.schedule('screen-l|body.m', 'tok', { size: 19 }, values);
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
