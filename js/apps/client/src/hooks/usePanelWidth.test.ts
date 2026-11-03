import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePanelWidth } from './usePanelWidth';

const limits = { min: 220, max: 320, initial: 280 };
const key = (name: string, shiftKey = false) =>
    ({ key: name, shiftKey, preventDefault: () => undefined }) as unknown as KeyboardEvent<HTMLElement>;

describe('usePanelWidth', () => {
    beforeEach(() => localStorage.clear());

    it('reads the stored side and keeps other fields of the stored object', () => {
        localStorage.setItem('panels', JSON.stringify({ left: 300, right: 360 }));
        const { result } = renderHook(() => usePanelWidth({ storageKey: 'panels', limits, side: 'left' }));

        expect(result.current.width).toBe(300);
        expect(result.current.style).toEqual({ '--panel-left': '300px' });
        act(() => result.current.resizerProps.onKeyDown(key('ArrowRight')));

        expect(JSON.parse(localStorage.getItem('panels')!)).toEqual({ left: 308, right: 360 });
    });

    it('mirrors the arrows for a right panel and clamps to the limits', () => {
        const { result } = renderHook(() => usePanelWidth({ storageKey: 'panels', limits, side: 'right' }));

        act(() => result.current.resizerProps.onKeyDown(key('ArrowLeft', true)));
        expect(result.current.width).toBe(296);
        act(() => result.current.resizerProps.onKeyDown(key('Home')));
        expect(result.current.width).toBe(220);
        act(() => result.current.resizerProps.onKeyDown(key('ArrowRight')));
        expect(result.current.width).toBe(220);
    });

    it('clamps a stored width outside of the limits', () => {
        localStorage.setItem('panels', JSON.stringify({ left: 900 }));
        const { result } = renderHook(() => usePanelWidth({ storageKey: 'panels', limits }));

        expect(result.current.width).toBe(320);
    });
});
