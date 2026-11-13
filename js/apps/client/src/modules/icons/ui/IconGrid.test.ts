import { describe, expect, it } from 'vitest';

import { revealScrollTop } from './IconGrid';

describe('revealScrollTop', () => {
    it('keeps the first rows at the top', () => {
        expect(revealScrollTop(0, 6, 40, 216)).toBe(0);
        expect(revealScrollTop(11, 6, 40, 216)).toBe(0);
    });

    it('puts the selected row in the middle of the window', () => {
        // индекс 60 при 6 колонках — десятая строка (смещение 400); середина окна 216 при карточке 40: 400 − 88
        expect(revealScrollTop(60, 6, 40, 216)).toBe(312);
    });

    it('tolerates an unknown column count', () => {
        expect(revealScrollTop(5, 0, 40, 216)).toBe(112);
    });
});
