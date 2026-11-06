import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readWidths, usePanelWidths } from './usePanelWidths';

const KEY = 'test_panels';

const press = (key: string, shiftKey = false) =>
    ({ key, shiftKey, preventDefault: vi.fn() }) as unknown as KeyboardEvent<HTMLButtonElement>;

afterEach(() => localStorage.clear());

describe('usePanelWidths', () => {
    it('стрелки расширяют панель в свою сторону, Home и End — до границ, ширина запоминается', () => {
        const { result } = renderHook(() => usePanelWidths(KEY));
        expect(result.current.panels).toEqual({ left: 280, right: 320 });

        act(() => result.current.separator('left').onKeyDown(press('ArrowRight')));
        act(() => result.current.separator('right').onKeyDown(press('ArrowRight', true)));
        expect(result.current.panels).toEqual({ left: 288, right: 304 });

        act(() => result.current.separator('left').onKeyDown(press('End')));
        act(() => result.current.separator('right').onKeyDown(press('Home')));
        expect(result.current.panels).toEqual({ left: 320, right: 280 });
        expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({ left: 320, right: 280 });

        const other = press('Tab');
        act(() => result.current.separator('left').onKeyDown(other));
        expect(other.preventDefault).not.toHaveBeenCalled();
        expect(result.current.separator('left')['aria-label']).toBe('Ширина сайдбара');
    });

    it('сохранённые ширины ограничиваются, испорченные и `null` дают ширины по умолчанию', () => {
        localStorage.setItem(KEY, JSON.stringify({ left: 900, right: 'x' }));
        expect(readWidths(KEY)).toEqual({ left: 320, right: 320 });
        localStorage.setItem(KEY, 'null');
        expect(readWidths(KEY)).toEqual({ left: 280, right: 320 });
        localStorage.setItem(KEY, '{');
        expect(readWidths(KEY)).toEqual({ left: 280, right: 320 });
    });
});
