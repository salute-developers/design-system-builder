import { describe, expect, it } from 'vitest';

import { checkerFill, tileLabelColor } from './swatch';

describe('плитка борда', () => {
    it('прозрачный цвет лежит поверх шахматки по всей половине', () => {
        const fill = checkerFill('#11883380') as Record<string, string>;
        const layers = fill.background.split(/,\s*(?=[a-z-]+-gradient\()/);
        expect(layers).toHaveLength(2);
        expect(layers[0]).toBe('linear-gradient(#11883380, #11883380)');
        expect(layers[1]).toMatch(/^conic-gradient\(.*\) 0 0 \/ 8px 8px$/);
        expect(fill['--swatch-color']).toBe('#11883380');
    });

    it('градиент — своими слоями поверх шахматки', () => {
        const fill = checkerFill('linear-gradient(45deg, #000 0%, #fff 100%)') as Record<string, string>;
        expect(fill.background.startsWith('linear-gradient(45deg, #000 0%, #fff 100%), conic-gradient(')).toBe(true);
    });

    it('подпись режима — #56585c на светлом цвете и #dbdbdc на тёмном', () => {
        expect(tileLabelColor('#FFFFFF')).toBe('#56585c');
        expect(tileLabelColor('#101010')).toBe('#dbdbdc');
        expect(tileLabelColor('#0B7ECB')).toBe('#dbdbdc');
        expect(tileLabelColor('transparent')).toBe('#dbdbdc');
    });
});
