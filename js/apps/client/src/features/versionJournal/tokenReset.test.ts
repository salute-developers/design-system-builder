import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DraftTokenTarget } from '../../api/editorContracts';

const repository = vi.hoisted(() => ({ listTokenTargets: vi.fn(), revertAddressed: vi.fn() }));
vi.mock('../../api/versionJournalRepository', () => ({ versionJournalRepository: repository }));
vi.mock('../../api/draftAutosaveActivity', () => ({ waitForDraftAutosaveIdle: vi.fn().mockResolvedValue(undefined) }));

import { resetTokenChanges, TokenResetError, useTokenReset } from './tokenReset';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 'theme-a' };
const change = (id: string, patch: Partial<DraftTokenTarget> = {}): DraftTokenTarget => ({
    entityType: 'token-value', entityId: `value-${id}`, operation: 'updated', expectedRevision: 1, ...patch,
});
const scoped = (targets: DraftTokenTarget[]) => ({ draftId: 'draft', targets });

describe('tokenReset', () => {
    beforeEach(() => {
        repository.listTokenTargets.mockReset();
        repository.revertAddressed.mockReset().mockResolvedValue(undefined);
    });

    it('reads scoped targets and sends addresses in server order', async () => {
        const targets = [change('2'), change('1', {entityType: 'token', entityId: 't1'})];
        repository.listTokenTargets.mockResolvedValue(scoped(targets));
        expect(await resetTokenChanges(context, new Set(['t1']))).toBe(2);
        expect(repository.listTokenTargets).toHaveBeenCalledWith(context, new Set(['t1']), undefined);
        expect(repository.revertAddressed).toHaveBeenCalledExactlyOnceWith(context, 'draft', targets);
    });

    it('does not mutate empty selection and chunks large target sets', async () => {
        repository.listTokenTargets.mockResolvedValue(scoped([]));
        expect(await resetTokenChanges(context, new Set(['t1']))).toBe(0);
        expect(repository.revertAddressed).not.toHaveBeenCalled();
        const targets = Array.from({length:201}, (_, i) => change(String(i)));
        repository.listTokenTargets.mockResolvedValue(scoped(targets));
        expect(await resetTokenChanges(context, new Set(['t1']))).toBe(201);
        expect(repository.revertAddressed.mock.calls.map(([, , batch]) => batch.length)).toEqual([200,1]);
    });

    it('rejects created definitions before any mutation', async () => {
        repository.listTokenTargets.mockResolvedValue(scoped([change('1'),
            change('2', {entityType:'token', operation:'created'})]));
        await expect(resetTokenChanges(context, new Set(['t1']))).rejects.toBeInstanceOf(TokenResetError);
        expect(repository.revertAddressed).not.toHaveBeenCalled();
    });

    it('refreshes successful and unknown batches without sending remaining targets', async () => {
        const targets = Array.from({length:401}, (_, i) => change(String(i)));
        repository.listTokenTargets.mockResolvedValue(scoped(targets));
        repository.revertAddressed.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('lost response'));
        const onDone = vi.fn();
        const {result} = renderHook(() => useTokenReset(context,onDone));
        await act(() => result.current.reset(new Set(['t1'])));
        expect(repository.revertAddressed).toHaveBeenCalledTimes(2);
        expect(onDone).toHaveBeenCalledWith(targets.slice(0,400));
        expect(result.current.error).toBeTruthy();
        expect(result.current.busy).toBe(false);
    });

    it('waits for refresh and releases busy on refresh failure without another mutation', async () => {
        repository.listTokenTargets.mockResolvedValue(scoped([change('1')]));
        let rejectRefresh!: (cause:Error) => void;
        const refresh = new Promise<void>((_, reject) => {rejectRefresh=reject;});
        const {result} = renderHook(() => useTokenReset(context,() => refresh));
        let pending!:Promise<void>;
        await act(async () => {pending=result.current.reset(new Set(['t1'])); await Promise.resolve();});
        expect(result.current.busy).toBe(true);
        await act(async () => {rejectRefresh(new Error('failed')); await pending;});
        expect(result.current.busy).toBe(false);
        expect(result.current.error).toBeTruthy();
        expect(repository.revertAddressed).toHaveBeenCalledTimes(1);
    });

    it('prevents duplicate clicks before rerender and forwards known draft', async () => {
        repository.listTokenTargets.mockResolvedValue(scoped([change('1')]));
        const {result} = renderHook(() => useTokenReset(context,vi.fn(),'draft'));
        await act(async () => {await Promise.all([result.current.reset(new Set(['t1'])),result.current.reset(new Set(['t1']))]);});
        expect(repository.listTokenTargets).toHaveBeenCalledExactlyOnceWith(context,new Set(['t1']),'draft');
        expect(repository.revertAddressed).toHaveBeenCalledTimes(1);
    });
    it('reloads context after failed discovery and retries with the fresh draft', async () => {
        repository.listTokenTargets.mockRejectedValueOnce({ response: { status: 409, data: { code: 'DRAFT_CHANGED' } } })
            .mockResolvedValueOnce({ draftId: 'fresh', targets: [change('1')] });
        let draftId = 'stale';
        const reload = vi.fn(() => { draftId = 'fresh'; });
        const onDone = vi.fn();
        const { result, rerender } = renderHook(() => useTokenReset(context, onDone, draftId, reload));
        await act(() => result.current.reset(new Set(['t1'])));
        expect(reload).toHaveBeenCalledTimes(1);
        expect(onDone).not.toHaveBeenCalled();
        expect(repository.revertAddressed).not.toHaveBeenCalled();
        rerender();
        await act(() => result.current.reset(new Set(['t1'])));
        expect(repository.listTokenTargets).toHaveBeenLastCalledWith(context, new Set(['t1']), 'fresh');
        expect(repository.revertAddressed).toHaveBeenCalledWith(context, 'fresh', [change('1')]);
        expect(result.current.error).toBeNull();
    });

    it('keeps an empty successful discovery local without reloading the editor', async () => {
        repository.listTokenTargets.mockResolvedValueOnce(scoped([]));
        const reload = vi.fn();
        const onDone = vi.fn();
        const { result } = renderHook(() => useTokenReset(context, onDone, 'draft', reload));
        await act(() => result.current.reset(new Set(['t1'])));
        expect(reload).not.toHaveBeenCalled();
        expect(onDone).toHaveBeenCalledWith([]);
    });

});
