import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCoreCompatibility } from './useCoreCompatibility';
import type { CoreCompatibilityReport } from '../api/coreCompatibilityRepository';

const mocks = vi.hoisted(() => ({ read: vi.fn(), invalidate: vi.fn() }));
vi.mock('../api/coreCompatibilityRepository', () => ({ coreCompatibilityRepository: { read: mocks.read } }));
vi.mock('../api/editorReads', () => ({ invalidateEditorReads: mocks.invalidate }));
const context = { projectId: 'project', designSystemId: 'ds-a', tenantId: 'tenant' };
const report = (releaseId: string, system = 'ds-a'): CoreCompatibilityReport => ({
    context: { designSystemId: system, versionId: null, draftId: 'draft', draftRevision: 7,
        coreReleases: [{ releaseId, libraryId: 'core', platform: 'compose', version: releaseId,
            metaSha256: null, provenance: 'imported' }] },
    items: [], blockingCount: 0, warningCount: 0, validatorVersion: 1, nextCursor: null,
});
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it('reloads the model when Core changes without changing the draft revision', async () => {
    mocks.read.mockResolvedValueOnce(report('A')).mockResolvedValueOnce(report('B'));
    const reload = vi.fn();
    const { result } = renderHook(() => useCoreCompatibility(context, undefined, reload));
    await waitFor(() => expect(result.current.report?.context.coreReleases[0].releaseId).toBe('A'));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(result.current.report?.context.coreReleases[0].releaseId).toBe('B'));
    expect(result.current.report?.context.draftRevision).toBe(7);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(mocks.invalidate).toHaveBeenLastCalledWith(context);
});

it('ignores a delayed report from the previous design system', async () => {
    let resolveOld!: (report: CoreCompatibilityReport) => void;
    mocks.read.mockReturnValueOnce(new Promise<CoreCompatibilityReport>((resolve) => { resolveOld = resolve; }))
        .mockResolvedValueOnce(report('B', 'ds-b'));
    const { result, rerender } = renderHook(({ system }) =>
        useCoreCompatibility({ ...context, designSystemId: system }), { initialProps: { system: 'ds-a' } });
    rerender({ system: 'ds-b' });
    await waitFor(() => expect(result.current.report?.context.designSystemId).toBe('ds-b'));
    await act(async () => resolveOld(report('A')));
    expect(result.current.report?.context.designSystemId).toBe('ds-b');
    expect(mocks.read.mock.calls[0][2].aborted).toBe(true);
});
