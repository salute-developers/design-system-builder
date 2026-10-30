import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './apiRequest';
import { invalidateQueryCache, isAccessDenied, resetQueryCache, setQueryCache, useLoad } from './useLoad';

const Probe = ({ loader, cacheKey, label }: { loader: () => Promise<string>; cacheKey: string; label: string }) => {
    const state = useLoad(loader, [], cacheKey);
    return (
        <span>
            {label}:{state.data ?? (state.error ? 'error' : 'loading')}
        </span>
    );
};

const ProjectDetailProbe = ({ loader }: { loader: () => Promise<{ ownerDisplayName?: string }> }) => {
    const state = useLoad(loader, [], 'project:project-1');
    return <span>owner:{state.data?.ownerDisplayName ?? (state.data ? 'missing' : 'loading')}</span>;
};

afterEach(resetQueryCache);

describe('useLoad query store', () => {
    it('refreshes only active invalidated keys and leaves hidden resources lazy', async () => {
        const active = vi.fn().mockResolvedValue('ready');
        const hidden = vi.fn().mockResolvedValue('hidden');
        renderHook(() => useLoad(active, [], 'active'));
        const previous = renderHook(() => useLoad(hidden, [], 'hidden'));
        await act(async () => {});
        previous.unmount();
        act(() => invalidateQueryCache('active', 'hidden'));
        await act(async () => {});
        expect(active).toHaveBeenCalledTimes(2);
        expect(hidden).toHaveBeenCalledOnce();
    });

    it('aborts shared transport only when its last mounted consumer leaves', async () => {
        let signal: AbortSignal | undefined;
        const loader = vi.fn((current?: AbortSignal) => {
            signal = current;
            return new Promise<string>(() => {});
        });
        const first = renderHook(() => useLoad(loader, [], 'cancel'));
        const second = renderHook(() => useLoad(loader, [], 'cancel'));
        await act(async () => first.unmount());
        expect(signal?.aborted).toBe(false);
        expect(loader).toHaveBeenCalledOnce();
        await act(async () => second.unmount());
        expect(signal?.aborted).toBe(true);
    });

    it('reuses fresh data on remount and revalidates expired data only when used', async () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(100_000);
        const loader = vi.fn().mockResolvedValue('ready');
        const first = render(<Probe loader={loader} cacheKey="fresh" label="first" />);
        await screen.findByText('first:ready');
        first.unmount();
        const second = render(<Probe loader={loader} cacheKey="fresh" label="second" />);
        expect(screen.getByText('second:ready')).toBeInTheDocument();
        expect(loader).toHaveBeenCalledTimes(1);
        now.mockReturnValue(131_000);
        expect(loader).toHaveBeenCalledTimes(1);
        await act(async () => window.dispatchEvent(new Event('focus')));
        expect(loader).toHaveBeenCalledTimes(2);
        second.unmount();
        now.mockRestore();
    });

    it('does not load disabled consumers even on focus', async () => {
        const loader = vi.fn().mockResolvedValue([]);
        const { rerender } = renderHook(({ enabled }) => useLoad(loader, [], 'lazy', enabled), {
            initialProps: { enabled: false },
        });
        await act(async () => window.dispatchEvent(new Event('focus')));
        expect(loader).not.toHaveBeenCalled();
        rerender({ enabled: true });
        await act(async () => {});
        expect(loader).toHaveBeenCalledOnce();
    });

    it('deduplicates concurrent consumers and publishes the result to both', async () => {
        let resolve!: (value: string) => void;
        const loader = vi.fn(
            () =>
                new Promise<string>((done) => {
                    resolve = done;
                }),
        );
        render(
            <>
                <Probe loader={loader} cacheKey="shared" label="first" />
                <Probe loader={loader} cacheKey="shared" label="second" />
            </>,
        );
        expect(loader).toHaveBeenCalledTimes(1);
        await act(async () => resolve('ready'));
        expect(screen.getByText('first:ready')).toBeInTheDocument();
        expect(screen.getByText('second:ready')).toBeInTheDocument();
    });

    it('does not let an older in-flight response overwrite an explicit fresh value', async () => {
        let resolve!: (value: string) => void;
        const loader = vi.fn(
            () =>
                new Promise<string>((done) => {
                    resolve = done;
                }),
        );
        render(<Probe loader={loader} cacheKey="race" label="value" />);
        act(() => setQueryCache('race', 'fresh'));
        await act(async () => resolve('stale'));
        expect(screen.getByText('value:fresh')).toBeInTheDocument();
    });

    it('does not use a collection project without owner identity as project details', async () => {
        act(() =>
            setQueryCache('projects', [
                {
                    id: 'project-1',
                    name: 'Platform',
                    ownerUserId: 'owner-1',
                },
            ]),
        );
        let resolve!: (value: { ownerDisplayName: string }) => void;
        const loader = vi.fn(
            () =>
                new Promise<{ ownerDisplayName: string }>((done) => {
                    resolve = done;
                }),
        );

        render(<ProjectDetailProbe loader={loader} />);

        expect(screen.getByText('owner:loading')).toBeInTheDocument();
        expect(loader).toHaveBeenCalledTimes(1);
        await act(async () => resolve({ ownerDisplayName: 'Admin Admin' }));
        expect(screen.getByText('owner:Admin Admin')).toBeInTheDocument();
    });

    it('preserves API errors for access decisions', () => {
        expect(isAccessDenied(new ApiError(403))).toBe(true);
        expect(isAccessDenied(new ApiError(500))).toBe(false);
    });
});
