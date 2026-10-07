import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ThemePalette } from '../modules/palette';
import { getActivePalette } from '../palette/activePalette';
import { useDesignSystem } from './useDesignSystem';

describe('useDesignSystem.setPalette', () => {
    it('отбрасывает палитру не открытой сейчас темы', () => {
        const { result } = renderHook(() => useDesignSystem());
        act(() => result.current.setPalette({ tenantId: 'previous' } as ThemePalette));
        expect(result.current.palette).toBeNull();
        expect(getActivePalette()).toBeNull();
    });
});
