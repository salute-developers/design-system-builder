import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './apiRequest';
import { isAccessDenied, resetQueryCache, setQueryCache, useLoad } from './useLoad';

const Probe = ({ loader, cacheKey, label }: { loader: () => Promise<string>; cacheKey: string; label: string }) => {
    const state = useLoad(loader, [], cacheKey);
    return (
        <span>
            {label}:{state.data ?? (state.error ? 'error' : 'loading')}
        </span>
    );
};

const ProjectDetailProbe = ({
    loader,
}: {
    loader: () => Promise<{ ownerDisplayName?: string }>;
}) => {
    const state = useLoad(loader, [], 'project:project-1');
    return <span>owner:{state.data?.ownerDisplayName ?? (state.data ? 'missing' : 'loading')}</span>;
};

afterEach(resetQueryCache);

describe('useLoad query store', () => {
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
