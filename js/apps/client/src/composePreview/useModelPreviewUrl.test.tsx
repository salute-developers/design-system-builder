import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useModelPreviewUrl } from './useModelPreviewUrl';

const invalidate = vi.hoisted(() => vi.fn());
vi.mock('../api/editorReads', () => ({ invalidateEditorReads: invalidate }));
const context = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

it('disconnects B from model A, reloads once, and reconnects after model B arrives', () => {
    const reload = vi.fn();
    const { result, rerender } = renderHook(({ model, preview }) => useModelPreviewUrl(
        context, model, { pluginUrl: `https://preview/${preview}`, coreRelease: { releaseId: preview } }, reload,
    ), { initialProps: { model: 'A', preview: 'A' } });

    expect(result.current).toBe('https://preview/A');
    expect(reload).not.toHaveBeenCalled();
    rerender({ model: 'A', preview: 'B' });
    expect(result.current).toBeUndefined();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith(context);
    rerender({ model: 'A', preview: 'B' });
    expect(reload).toHaveBeenCalledTimes(1);
    rerender({ model: 'B', preview: 'B' });
    expect(result.current).toBe('https://preview/B');
});

it('allows explicit development URLs without a server Core identity', () => {
    const reload = vi.fn();
    const { result } = renderHook(() => useModelPreviewUrl(
        context, 'A', { pluginUrl: 'http://localhost:3011' }, reload,
    ));
    expect(result.current).toBe('http://localhost:3011');
    expect(reload).not.toHaveBeenCalled();
});
