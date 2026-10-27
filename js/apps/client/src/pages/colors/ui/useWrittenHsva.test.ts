import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { hexToHsva, hsvaToHex } from './colorMath';
import { useWrittenHsva } from './useWrittenHsva';

describe('положение ползунков выбора цвета', () => {
    it('сохраняет тон почти белого и почти чёрного цвета, пока цвет не изменился', () => {
        for (const written of [
            { h: 216, s: 0.005, v: 0.995, a: 1 },
            { h: 108, s: 0.01, v: 0.005, a: 1 },
        ]) {
            const hex = hsvaToHex(written);
            // Из HEX такой тон не восстанавливается.
            expect(Math.round(hexToHsva(hex).h)).not.toBe(written.h);
            const { result, rerender } = renderHook(({ value }) => useWrittenHsva(value), {
                initialProps: { value: '#22AA44' },
            });
            result.current[1](written);
            rerender({ value: hex });
            expect(result.current[0]).toEqual(written);
            rerender({ value: '#22AA44' });
            expect(result.current[0]).toEqual(hexToHsva('#22AA44'));
        }
    });
});
