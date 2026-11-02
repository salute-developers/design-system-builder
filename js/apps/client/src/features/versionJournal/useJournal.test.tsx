import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { errorCode, useJournal } from './useJournal';

const mocks = vi.hoisted(() => ({ listChanges: vi.fn(), listDefinitions: vi.fn(), listProjectActorLabels: vi.fn() }));
vi.mock('../../api/versionJournalRepository', () => ({ versionJournalRepository: mocks }));
vi.mock('../../api/tokenRepository', () => ({ tokenRepository: mocks }));
vi.mock('./journalPresenter', () => ({ presentJournal: () => [], isComponentJournalChange: () => false }));
const context = { projectId: 'project', designSystemId: 'system', tenantId: 'theme' };
const definition = { entityType: 'token', entityId: 'token', editRevision: 1 };
beforeEach(() => {
    vi.resetAllMocks();
    mocks.listChanges.mockResolvedValue([{ entityType: 'token-value', entityId: 'value', editRevision: 1 }]);
    mocks.listDefinitions.mockResolvedValue([{ id: 'token', name: 'accent' }]);
    mocks.listProjectActorLabels.mockResolvedValue({});
});
afterEach(cleanup);

describe('journal reads', () => {
    it('reuses fresh names for a value revert but rereads after a definition changes', async () => {
        const { result } = renderHook(() => useJournal(context, [], 'draft:1'));
        await waitFor(() => expect(result.current.loading).toBe(false));
        mocks.listChanges.mockResolvedValue([]);
        await act(async () => {
            await result.current.reloadChecked();
        });
        expect(mocks.listChanges).toHaveBeenCalledTimes(2);
        expect(mocks.listDefinitions).toHaveBeenCalledOnce();
        mocks.listChanges.mockResolvedValue([definition]);
        await act(async () => {
            await result.current.reloadChecked();
        });
        expect(mocks.listDefinitions).toHaveBeenCalledTimes(2);
        mocks.listChanges.mockResolvedValue([{ ...definition, editRevision: 2 }]);
        await act(async () => {
            await result.current.reloadChecked();
        });
        expect(mocks.listDefinitions).toHaveBeenCalledTimes(3);
    });

    it('does not read a hidden journal', async () => {
        const { rerender } = renderHook(({ enabled }) => useJournal(context, [], 'draft:1', false, enabled), {
            initialProps: { enabled: false },
        });
        await act(async () => {});
        expect(mocks.listChanges).not.toHaveBeenCalled();
        expect(mocks.listDefinitions).not.toHaveBeenCalled();
        rerender({ enabled: true });
        await waitFor(() => expect(mocks.listChanges).toHaveBeenCalledOnce());
    });

    it('recognizes both code and error envelopes for the journal limit', () => {
        for (const key of ['code', 'error']) {
            const failure = new AxiosError('limited', undefined, undefined, undefined, {
                status: 422,
                data: { [key]: 'JOURNAL_LIMIT_EXCEEDED' },
            } as AxiosResponse);
            expect(errorCode(failure)).toBe('JOURNAL_LIMIT_EXCEEDED');
        }
    });
});

it('принимает точный total того же ответа журнала без отдельного summary', async () => {
    mocks.listChanges.mockImplementation(async (_context, _signal, onTotal) => {
        onTotal?.(17);
        return [];
    });
    const { result } = renderHook(() => useJournal(context, [], 'cursor', false, true));
    await waitFor(() => expect(result.current.total).toBe(17));
    expect(mocks.listChanges).toHaveBeenCalledOnce();
});
