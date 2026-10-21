import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DraftChangeDto } from '../../api/editorContracts';
import type { JournalActionViewModel } from './journalPresenter';

const operations = vi.hoisted(() => ({ revertChange: vi.fn(), waitForDraftAutosaveIdle: vi.fn() }));
vi.mock('../../api/versionJournalRepository', () => ({ versionJournalRepository: operations }));
vi.mock('../../api/draftAutosaveActivity', () => operations);

import { useJournalRevert } from './useJournalRevert';

const context = { projectId: 'project', designSystemId: 'system', tenantId: 'tenant' };
const changes = [1, 2, 3].map((id) => ({ changeId: String(id), entityType: 'token-value', entityId: String(id) }) as DraftChangeDto);
const action = { key: 'combined', canRevert: true, changes } as JournalActionViewModel;

beforeEach(() => {
    operations.revertChange.mockReset().mockResolvedValue({});
    operations.waitForDraftAutosaveIdle.mockReset().mockResolvedValue(undefined);
});

it('сверяет успешную и неизвестную части после ошибки, не отправляя оставшуюся отмену', async () => {
    operations.revertChange.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('response lost'));
    const reload = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useJournalRevert(context, reload, refresh));
    await act(() => result.current.revert(action));
    expect(operations.revertChange).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledWith(changes.slice(0, 2));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.operationError).toContain('Не удалось полностью отменить');
    expect(result.current.refreshFailed).toBe(false);
});

it('после сбоя сверки повторяет только чтения и сохраняет сообщение о частичной отмене', async () => {
    operations.revertChange.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('offline'));
    const refresh = vi.fn().mockRejectedValueOnce(new Error('refresh failed')).mockResolvedValue(undefined);
    const { result } = renderHook(() => useJournalRevert(context, vi.fn().mockResolvedValue(undefined), refresh));
    await act(() => result.current.revert(action));
    expect(result.current.refreshFailed).toBe(true);
    await act(() => result.current.revert(action));
    expect(operations.revertChange).toHaveBeenCalledTimes(2);
    await act(() => result.current.retryRefresh());
    expect(operations.revertChange).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(result.current.refreshFailed).toBe(false);
    expect(result.current.operationError).toContain('Не удалось полностью отменить');
});

it('перечитывает неизвестный результат уже первой команды после потери ответа', async () => {
    operations.revertChange.mockRejectedValueOnce(new Error('503 after commit'));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useJournalRevert(context, vi.fn().mockResolvedValue(undefined), refresh));
    await act(() => result.current.revert(action));
    expect(refresh).toHaveBeenCalledWith([changes[0]]);
    expect(operations.revertChange).toHaveBeenCalledTimes(1);
});

it('не снимает блокировку при раннем отказе одного чтения, пока второе ещё выполняется', async () => {
    let complete!: () => void;
    const reload = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { complete = resolve; }));
    const refresh = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useJournalRevert(context, reload, refresh));
    let pending!: Promise<void>;
    await act(async () => {
        pending = result.current.revert(action);
        await Promise.resolve();
    });
    expect(result.current.reverting).toBe(action.key);
    await act(() => result.current.revert(action));
    expect(operations.revertChange).toHaveBeenCalledTimes(3);
    await act(async () => {
        complete();
        await pending;
    });
    expect(result.current.refreshFailed).toBe(true);
});
