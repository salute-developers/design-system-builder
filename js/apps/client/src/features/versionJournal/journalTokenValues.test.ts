import { describe, expect, it } from 'vitest';

import { journalTokenValue, journalValueStructureChanged } from './journalTokenValues';

describe('представление значений токенов', () => {
    it('преобразует только известные параметры типографики, не меняя исходное значение', () => {
        const value = {
            fontSize: '1.25rem',
            lineHeight: '24px',
            letterSpacing: '0.125em',
            fontWeight: '500',
            extra: { fontSize: 'keep' },
        };
        expect(journalTokenValue(value, 'typography')).toEqual({
            fontSize: 20,
            lineHeight: 24,
            letterSpacing: 2,
            fontWeight: '500',
            extra: value.extra,
        });
        expect(value.fontSize).toBe('1.25rem');
        expect(journalTokenValue({ letterSpacing: 'normal' }, 'typography')).toEqual({ letterSpacing: 0 });
    });

    it('сохраняет неизвестные параметры, включая имена свойств прототипа', () => {
        const value = JSON.parse('{"constructor":"custom","__proto__":"data","toString":"label"}');
        expect(journalTokenValue(value, 'typography')).toEqual(value);
    });

    it('разворачивает старые скалярные значения, но не слои', () => {
        expect(journalTokenValue([['1rem']], 'shape')).toBe(16);
        expect(journalTokenValue([{ name: 'Font', fonts: [] }], 'fontFamily')).toEqual({ name: 'Font', fonts: [] });
        expect(journalTokenValue(['red'], 'gradient')).toEqual(['red']);
        expect(journalTokenValue(['1rem', '2rem'], 'shape')).toEqual(['1rem', '2rem']);
    });

    it('сохраняет неизвестные значения без преобразования', () => {
        expect(journalTokenValue(null, 'typography')).toBeNull();
        expect(journalTokenValue('auto', 'spacing')).toBe('auto');
        expect(journalTokenValue(12, 'spacing')).toBe(12);
        expect(journalTokenValue('raw')).toBe('raw');
    });
});

describe('структура слоёв', () => {
    it('не считает изменение одного параметра изменением структуры', () => {
        expect(journalValueStructureChanged([{ blur: 1 }], [{ blur: 2 }])).toBe(false);
        expect(journalValueStructureChanged({ fontSize: 12 }, { fontSize: 14 })).toBe(false);
    });

    it('распознаёт вставку, перестановку, смену контейнера и дублирующиеся слои', () => {
        expect(journalValueStructureChanged(['red'], ['red', 'blue'])).toBe(true);
        expect(journalValueStructureChanged(['red', 'blue'], ['blue', 'red'])).toBe(true);
        expect(journalValueStructureChanged(['red'], 'red')).toBe(true);
        expect(journalValueStructureChanged(['red', 'blue', 'blue'], ['blue', 'red', 'blue'])).toBe(true);
        expect(journalValueStructureChanged(['red', 'blue'], ['blue', 'blue'])).toBe(false);
        expect(journalValueStructureChanged(['red', 'red'], ['red', 'red'])).toBe(false);
        expect(journalValueStructureChanged(null, { blur: 1 })).toBe(true);
    });
});
