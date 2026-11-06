import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftChangeDto } from '../../api/editorContracts';

const repository = vi.hoisted(() => ({ listChanges: vi.fn(), revertChanges: vi.fn() }));
vi.mock('../../api/versionJournalRepository', () => ({ versionJournalRepository: repository }));
vi.mock('../../api/draftAutosaveActivity', () => ({ waitForDraftAutosaveIdle: vi.fn().mockResolvedValue(undefined) }));

import { changedTokenId, resetTokenChanges, TokenResetError, useTokenReset } from './tokenReset';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 'theme-a' };
const change = (id: string, patch: Partial<DraftChangeDto>): DraftChangeDto => ({
    changeId: id,
    versionId: 'draft',
    entityType: 'token-value',
    entityId: `value-${id}`,
    operation: 'updated',
    changedPaths: ['/value'],
    previousValue: null,
    currentValue: null,
    actorId: null,
    changedAt: '2026-10-30T10:00:00Z',
    editRevision: 1,
    ...patch,
});

describe('tokenReset', () => {
    beforeEach(() => {
        repository.listChanges.mockReset();
        repository.revertChanges.mockReset().mockResolvedValue(undefined);
    });

    it('относит к токену определение и значения только этой темы', () => {
        expect(changedTokenId(change('1', { entityType: 'token', entityId: 't1' }), 'theme-a')).toBe('t1');
        expect(changedTokenId(change('2', { currentValue: { token_id: 't1', tenant_id: 'theme-a' } }), 'theme-a')).toBe(
            't1',
        );
        expect(
            changedTokenId(change('3', { currentValue: { token_id: 't1', tenant_id: 'theme-b' } }), 'theme-a'),
        ).toBeNull();
        expect(changedTokenId(change('4', { entityType: 'component' }), 'theme-a')).toBeNull();
    });

    it('откатывает записи токена одним пакетом от новой к старой и не трогает чужие', async () => {
        repository.listChanges.mockResolvedValue([
            change('old', {
                currentValue: { token_id: 't1', tenant_id: 'theme-a' },
                changedAt: '2026-10-30T09:00:00Z',
            }),
            change('other', { currentValue: { token_id: 't2', tenant_id: 'theme-a' } }),
            change('new', { entityType: 'token', entityId: 't1', changedAt: '2026-10-30T11:00:00Z' }),
        ]);

        expect(await resetTokenChanges(context, new Set(['t1']))).toBe(2);
        expect(repository.revertChanges).toHaveBeenCalledTimes(1);
        const [[, batch]] = repository.revertChanges.mock.calls as [[unknown, DraftChangeDto[]]];
        expect(batch.map((reverted) => reverted.changeId)).toEqual(['new', 'old']);
    });

    it('без записей токена не отправляет пакет, а больше 200 записей делит на пакеты по 200', async () => {
        repository.listChanges.mockResolvedValue([]);
        expect(await resetTokenChanges(context, new Set(['t1']))).toBe(0);
        expect(repository.revertChanges).not.toHaveBeenCalled();

        repository.listChanges.mockResolvedValue(
            Array.from({ length: 201 }, (_, index) =>
                change(String(index), { currentValue: { token_id: 't1', tenant_id: 'theme-a' } }),
            ),
        );
        expect(await resetTokenChanges(context, new Set(['t1']))).toBe(201);
        expect(repository.revertChanges.mock.calls.map(([, batch]) => (batch as unknown[]).length)).toEqual([200, 1]);
    });

    it('не откатывает токен, созданный в черновике: ни одной записи не отменяет', async () => {
        repository.listChanges.mockResolvedValue([
            change('value', {
                currentValue: { token_id: 't1', tenant_id: 'theme-a' },
                changedAt: '2026-10-30T11:00:00Z',
            }),
            change('created', { entityType: 'token', entityId: 't1', operation: 'created' }),
        ]);

        await expect(resetTokenChanges(context, new Set(['t1']))).rejects.toBeInstanceOf(TokenResetError);
        expect(repository.revertChanges).not.toHaveBeenCalled();
    });

    it('хук перечитывает данные после сброса и показывает причину отказа', async () => {
        const onDone = vi.fn();
        const { result } = renderHook(() => useTokenReset(context, onDone));

        repository.listChanges.mockResolvedValue([
            change('created', { entityType: 'token', entityId: 't1', operation: 'created' }),
        ]);
        await act(() => result.current.reset(new Set(['t1'])));
        expect(result.current.error).toBe('Токен создан в этом черновике: отменить его можно только удалением токена.');
        expect(onDone).toHaveBeenCalledTimes(1);

        repository.listChanges.mockRejectedValue(new Error('network'));
        await act(() => result.current.reset(new Set(['t1'])));
        expect(result.current.error).toBe('Не удалось сбросить изменения токена. Данные обновлены.');

        repository.listChanges.mockResolvedValue([]);
        await act(() => result.current.reset(new Set(['t1'])));
        expect(result.current.error).toBeNull();
        expect(result.current.busy).toBe(false);
        expect(onDone).toHaveBeenCalledTimes(3);
    });
});
