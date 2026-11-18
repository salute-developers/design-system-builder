import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { setIconFailed, useFailedIconUrls } from './iconLoadFailures';

const useIconLoadFailed = (url: string) => useFailedIconUrls().has(url);
const URLS = ['https://x.test/24/A.svg', 'https://x.test/24/B.svg', 'https://x.test/24/other.svg'];

describe('iconLoadFailures', () => {
    afterEach(() => {
        cleanup();
        act(() => URLS.forEach((url) => setIconFailed(url, false)));
    });

    it('reports a failed url and clears it after a successful load', () => {
        const { result } = renderHook(() => useIconLoadFailed('https://x.test/24/A.svg'));
        expect(result.current).toBe(false);

        act(() => setIconFailed('https://x.test/24/A.svg', true));
        expect(result.current).toBe(true);

        act(() => setIconFailed('https://x.test/24/A.svg', false));
        expect(result.current).toBe(false);
    });

    it('keeps urls independent of each other', () => {
        const first = renderHook(() => useIconLoadFailed('https://x.test/24/A.svg'));
        const second = renderHook(() => useIconLoadFailed('https://x.test/24/B.svg'));

        act(() => setIconFailed('https://x.test/24/A.svg', true));

        expect(first.result.current).toBe(true);
        expect(second.result.current).toBe(false);
    });

    it('treats an empty url as loaded', () => {
        const { result } = renderHook(() => useIconLoadFailed(''));
        act(() => setIconFailed('https://x.test/24/A.svg', true));
        expect(result.current).toBe(false);
    });

    it('notifies subscribers only when the state changes', () => {
        let renders = 0;
        renderHook(() => {
            renders += 1;
            return useIconLoadFailed('https://x.test/24/A.svg');
        });
        const initial = renders;

        act(() => setIconFailed('https://x.test/24/A.svg', true));
        const afterFirst = renders;
        act(() => setIconFailed('https://x.test/24/A.svg', true));
        act(() => setIconFailed('https://x.test/24/other.svg', false));

        expect(afterFirst).toBeGreaterThan(initial);
        expect(renders).toBe(afterFirst);
    });
});
