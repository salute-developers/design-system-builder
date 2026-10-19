import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVersionList } from './useVersionList';

const listVersions = vi.hoisted(() => vi.fn());
vi.mock('../../api/versionJournalRepository', () => ({ versionJournalRepository: { listVersions } }));

const context = { projectId: 'project', designSystemId: 'system', tenantId: 'tenant' };
const versions = [{ id: 'published', version: '1.0.0', sequenceNumber: 1 }];
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
};

beforeEach(() => listVersions.mockReset());
afterEach(cleanup);

describe('общая загрузка версий', () => {
    it('не применяет запоздавший ответ другого контекста', async () => {
        const first = deferred<typeof versions>();
        const second = deferred<typeof versions>();
        listVersions.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const { result, rerender } = renderHook(({ id }) => useVersionList({ ...context, designSystemId: id }), {
            initialProps: { id: 'first' },
        });
        rerender({ id: 'second' });
        expect(listVersions.mock.calls[0][1].aborted).toBe(true);
        await act(async () => second.resolve(versions));
        await act(async () => first.resolve([{ ...versions[0], id: 'stale' }]));
        expect(result.current.versions).toEqual(versions);
    });

    it('сохраняет список во время обновления истории', async () => {
        const next = deferred<typeof versions>();
        listVersions.mockResolvedValueOnce(versions).mockReturnValueOnce(next.promise);
        const { result } = renderHook(() => useVersionList(context));
        await waitFor(() => expect(result.current.loading).toBe(false));
        let pending!: Promise<void>;
        act(() => {
            pending = result.current.reload();
        });
        expect(result.current.versions).toEqual(versions);
        expect(result.current.loading).toBe(true);
        await act(async () => {
            next.resolve([]);
            await pending;
        });
        expect(result.current.versions).toEqual([]);
    });

    it('очищает варианты селектора при обновлении и прерывает запрос при закрытии', async () => {
        listVersions.mockResolvedValueOnce(versions).mockReturnValueOnce(new Promise(() => {}));
        const { result, rerender, unmount } = renderHook(({ refresh }) => useVersionList(context, refresh, true), {
            initialProps: { refresh: 1 },
        });
        await waitFor(() => expect(result.current.versions).toEqual(versions));
        rerender({ refresh: 2 });
        expect(result.current.versions).toEqual([]);
        const signal = listVersions.mock.calls[1][1];
        unmount();
        expect(signal.aborted).toBe(true);
    });

    it('показывает ошибку и позволяет повторить загрузку', async () => {
        listVersions.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(versions);
        const { result } = renderHook(() => useVersionList(context));
        await waitFor(() => expect(result.current.error).toBe('Не удалось загрузить версии'));
        await act(async () => {
            await result.current.reload();
        });
        expect(result.current.error).toBeUndefined();
        expect(result.current.versions).toEqual(versions);
    });
});
