import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DraftChangeDto } from '../../api/editorContracts';
import type { JournalActionViewModel } from './journalPresenter';

const operations = vi.hoisted(() => ({ revertChange: vi.fn(), revertChanges: vi.fn(), waitForDraftAutosaveIdle: vi.fn() }));
vi.mock('../../api/versionJournalRepository', () => ({ versionJournalRepository: operations }));
vi.mock('../../api/draftAutosaveActivity', () => operations);

import { presentJournal } from './journalPresenter';
import { useJournalRevert } from './useJournalRevert';

const context = { projectId: 'project', designSystemId: 'system', tenantId: 'tenant' };
const changes = [1, 2, 3].map(
    (id) => ({ changeId: String(id), entityType: 'token-value', entityId: String(id) }) as DraftChangeDto,
);
const action = { key: 'combined', canRevert: true, changes } as JournalActionViewModel;

beforeEach(() => {
    operations.revertChange.mockReset().mockResolvedValue({});
    operations.revertChanges.mockReset().mockResolvedValue({});
    operations.waitForDraftAutosaveIdle.mockReset().mockResolvedValue(undefined);
});

it('сверяет успешную и неизвестную части после ошибки, не отправляя оставшуюся отмену', async () => {
    const many = Array.from({length:401}, (_, i) => ({...changes[0],entityId:String(i)}));
    const batchAction = {...action,changes:many};
    operations.revertChanges.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('response lost'));
    const reload = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useJournalRevert(context, reload, refresh));
    await act(() => result.current.revert(batchAction));
    expect(operations.revertChanges).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledWith(many.slice(0, 400));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.operationError).toContain('Не удалось полностью отменить');
    expect(result.current.refreshFailed).toBe(false);
});

it('после сбоя сверки повторяет только чтения и сохраняет сообщение о частичной отмене', async () => {
    const many = Array.from({length:401}, (_, i) => ({...changes[0],entityId:String(i)}));
    const batchAction = {...action,changes:many};
    operations.revertChanges.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('offline'));
    const refresh = vi.fn().mockRejectedValueOnce(new Error('refresh failed')).mockResolvedValue(undefined);
    const { result } = renderHook(() => useJournalRevert(context, vi.fn().mockResolvedValue(undefined), refresh));
    await act(() => result.current.revert(batchAction));
    expect(result.current.refreshFailed).toBe(true);
    await act(() => result.current.revert(batchAction));
    expect(operations.revertChanges).toHaveBeenCalledTimes(2);
    await act(() => result.current.retryRefresh());
    expect(operations.revertChanges).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(result.current.refreshFailed).toBe(false);
    expect(result.current.operationError).toContain('Не удалось полностью отменить');
});

it('перечитывает неизвестный результат уже первой команды после потери ответа', async () => {
    operations.revertChanges.mockRejectedValueOnce(new Error('503 after commit'));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useJournalRevert(context, vi.fn().mockResolvedValue(undefined), refresh));
    await act(() => result.current.revert(action));
    expect(refresh).toHaveBeenCalledWith(changes);
    expect(operations.revertChanges).toHaveBeenCalledTimes(1);
});

it('не снимает блокировку при раннем отказе одного чтения, пока второе ещё выполняется', async () => {
    let complete!: () => void;
    const reload = vi.fn().mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                complete = resolve;
            }),
    );
    const refresh = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useJournalRevert(context, reload, refresh));
    let pending!: Promise<void>;
    await act(async () => {
        pending = result.current.revert(action);
        await Promise.resolve();
    });
    expect(result.current.reverting).toBe(action.key);
    await act(() => result.current.revert(action));
    expect(operations.revertChanges).toHaveBeenCalledTimes(1);
    await act(async () => {
        complete();
        await pending;
    });
    expect(result.current.refreshFailed).toBe(true);
});

it('отменяет строку добавления стиля одним пакетом: сначала подключение, затем стиль', async () => {
    const record = (changeId: string, entityType: string, entityId: string, currentValue: Record<string, unknown>) =>
        ({
            changeId,
            versionId: 'draft',
            entityType,
            entityId,
            operation: 'created',
            changedPaths: Object.keys(currentValue).map((key) => `/${key}`),
            previousValue: null,
            currentValue,
            actorId: 'user',
            changedAt: '2026-11-06T07:03:58Z',
            editRevision: 1,
        }) as DraftChangeDto;
    const [row] = presentJournal({
        changes: [
            record('style-change', 'style', 'style-xxxs', { name: 'xxxs', variation_id: 'size' }),
            record('link-change', 'appearance-variation-value', 'link', { style_id: 'style-xxxs', position: 6 }),
        ],
        tokens: [],
        components: [],
        actorLabels: {},
        context,
    });
    const { result } = renderHook(() =>
        useJournalRevert(context, vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined)),
    );

    await act(() => result.current.revert(row));

    expect(operations.revertChanges).toHaveBeenCalledTimes(1);
    expect(operations.revertChange).not.toHaveBeenCalled();
    expect(operations.revertChanges.mock.calls[0][0]).toEqual(context);
    expect(operations.revertChanges.mock.calls[0][1].map((change: DraftChangeDto) => change.changeId)).toEqual([
        'link-change',
        'style-change',
    ]);
});
