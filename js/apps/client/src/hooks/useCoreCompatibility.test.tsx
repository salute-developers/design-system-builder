import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCoreCompatibility } from './useCoreCompatibility';
import { clearDsReadBoundaries, rememberDsReadBoundary } from '../api/dsReadBoundary';
import type { CoreCompatibilityReport } from '../api/coreCompatibilityRepository';

const mocks = vi.hoisted(() => ({ read: vi.fn(), invalidate: vi.fn() }));
vi.mock('../api/coreCompatibilityRepository', () => ({ coreCompatibilityRepository: { read: mocks.read } }));
vi.mock('../api/editorReads', () => ({ invalidateEditorReads: mocks.invalidate }));
const context = { projectId: 'project', designSystemId: 'ds-a', tenantId: 'tenant' };
const report = (releaseId: string, system = 'ds-a'): CoreCompatibilityReport => ({
    context: {
        designSystemId: system,
        versionId: null,
        draftId: 'draft',
        draftRevision: 7,
        coreReleases: [
            {
                releaseId,
                libraryId: 'core',
                platform: 'compose',
                version: releaseId,
                metaSha256: null,
                provenance: 'imported',
            },
        ],
    },
    items: [],
    blockingCount: 0,
    warningCount: 0,
    validatorVersion: 1,
    nextCursor: null,
});
beforeEach(() => vi.resetAllMocks());
afterEach(() => {
    cleanup();
    clearDsReadBoundaries();
});

it('reloads the model when Core changes without changing the draft revision', async () => {
    mocks.read.mockResolvedValueOnce(report('A')).mockResolvedValueOnce(report('B'));
    const reload = vi.fn();
    const { result } = renderHook(() => useCoreCompatibility(context, undefined, reload));
    await waitFor(() => expect(result.current.report?.context.coreReleases[0].releaseId).toBe('A'));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(result.current.report?.context.coreReleases[0].releaseId).toBe('B'));
    expect(result.current.report?.context.draftRevision).toBe(7);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(mocks.invalidate).toHaveBeenLastCalledWith(context, { includeMetadata: true });
});

it('ignores a delayed report from the previous design system', async () => {
    let resolveOld!: (report: CoreCompatibilityReport) => void;
    mocks.read
        .mockReturnValueOnce(
            new Promise<CoreCompatibilityReport>((resolve) => {
                resolveOld = resolve;
            }),
        )
        .mockResolvedValueOnce(report('B', 'ds-b'));
    const { result, rerender } = renderHook(
        ({ system }) => useCoreCompatibility({ ...context, designSystemId: system }),
        { initialProps: { system: 'ds-a' } },
    );
    rerender({ system: 'ds-b' });
    await waitFor(() => expect(result.current.report?.context.designSystemId).toBe('ds-b'));
    await act(async () => resolveOld(report('A')));
    expect(result.current.report?.context.designSystemId).toBe('ds-b');
    expect(mocks.read.mock.calls[0][2].aborted).toBe(true);
});

it('refreshes the report without invalidating the same Core or reloading the model again', async () => {
    mocks.read.mockResolvedValue(report('A'));
    const reload = vi.fn();
    const { result } = renderHook(() => useCoreCompatibility(context, undefined, reload));
    await waitFor(() => expect(result.current.report).toBeDefined());
    expect(reload).not.toHaveBeenCalled();
    act(() => result.current.reload());
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.report).toBeDefined());
    expect(reload).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
});

it('shares polling and keeps the last report visible during a refresh', async () => {
    mocks.read.mockResolvedValueOnce(report('A'));
    const first = renderHook(() => useCoreCompatibility(context));
    const second = renderHook(() => useCoreCompatibility(context));
    await waitFor(() => expect(first.result.current.report).toBeDefined());
    expect(second.result.current.report).toBe(first.result.current.report);
    expect(mocks.read).toHaveBeenCalledOnce();
    let finish!: (value: CoreCompatibilityReport) => void;
    mocks.read.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    act(() => window.dispatchEvent(new Event('focus')));
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(first.result.current.report?.context.coreReleases[0].releaseId).toBe('A');
    await act(async () => finish(report('B')));
    expect(second.result.current.report?.context.coreReleases[0].releaseId).toBe('B');
    expect(mocks.invalidate).toHaveBeenCalledOnce();
});

it('reloads on the first report only if its Core revision differs from the loaded model', async () => {
    const current = report('B');
    current.context.coreSelectionRevision = 2;
    mocks.read.mockResolvedValue(current);
    const reload = vi.fn();
    renderHook(() => useCoreCompatibility(context, undefined, reload, 1));
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(mocks.invalidate).toHaveBeenCalledWith(context, { includeMetadata: true });
});

it('does not restart requests from a late save callback after the last subscriber leaves', async () => {
    mocks.read.mockResolvedValue(report('A'));
    const view = renderHook(() => useCoreCompatibility(context));
    await waitFor(() => expect(view.result.current.report).toBeDefined());
    const refresh = view.result.current.reload;
    view.unmount();
    act(() => refresh());
    expect(mocks.read).toHaveBeenCalledOnce();
});

it('refreshes once when a late model has an older Core than the already loaded report', async () => {
    const current = report('B');
    current.context.coreSelectionRevision = 2;
    mocks.read.mockResolvedValue(current);
    const reload = vi.fn();
    const view = renderHook(
        ({ revision }: { revision?: number }) => useCoreCompatibility(context, undefined, reload, revision),
        { initialProps: { revision: undefined } },
    );
    await waitFor(() => expect(view.result.current.report).toBeDefined());
    expect(reload).not.toHaveBeenCalled();
    view.rerender({ revision: 1 });
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(2));
    expect(reload).toHaveBeenCalledOnce();
});

it.each([401, 403, 500])('clears a previously visible report only on access denial (%s)', async (status) => {
    mocks.read.mockResolvedValueOnce(report('A'));
    const view = renderHook(() => useCoreCompatibility(context));
    await waitFor(() => expect(view.result.current.report).toBeDefined());
    const previous = view.result.current.report;
    mocks.read.mockRejectedValueOnce({ isAxiosError: true, response: { status } });
    act(() => view.result.current.reload());
    await waitFor(() => expect(view.result.current.error).toBeDefined());
    expect(view.result.current.report).toBe(status === 500 ? previous : undefined);
});

it('shares the watch after StrictMode repeats the first subscription', async () => {
    mocks.read.mockResolvedValue(report('A'));
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const first = renderHook(() => useCoreCompatibility(context), { wrapper });
    await waitFor(() => expect(first.result.current.report).toBeDefined());
    mocks.read.mockClear();
    const second = renderHook(() => useCoreCompatibility(context));
    expect(second.result.current.report).toBe(first.result.current.report);
    expect(mocks.read).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledOnce());
});

it('does not request protected diagnostics for public components, including focus and reload', async () => {
    rememberDsReadBoundary('/api/projects/project/design-systems/ds-a', {
        designSystemId: 'ds-a',
        accessMode: 'public',
        versionId: 'published',
    });
    const { result } = renderHook(() => useCoreCompatibility({ ...context, versionId: 'published' }));
    act(() => window.dispatchEvent(new Event('focus')));
    act(() => result.current.reload());
    expect(mocks.read).not.toHaveBeenCalled();
    expect(result.current.report).toBeUndefined();
});
