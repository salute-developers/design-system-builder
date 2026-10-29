import { describe, expect, it } from 'vitest';

import { hexToHsva, hexToRgba, hsvaToHex, rgbaToHex } from './colorMath';

describe('преобразования цвета выбора цвета', () => {
    it('разбирает HEX любой длины и пишет HEX с альфой только при прозрачности', () => {
        expect(hexToRgba('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
        expect(hexToRgba('#11223380')).toMatchObject({ r: 17, g: 34, b: 51 });
        expect(hexToRgba('blue')).toBeNull();
        expect(rgbaToHex({ r: 17, g: 34, b: 51 })).toBe('#112233');
        expect(rgbaToHex({ r: 17, g: 34, b: 51 }, 0.5)).toBe('#11223380');
    });

    it('сохраняет цвет при переходе через HSV', () => {
        expect(hsvaToHex(hexToHsva('#1A9E32'))).toBe('#1A9E32');
        expect(hsvaToHex(hexToHsva('#04C6C980'))).toBe('#04C6C980');
    });
});
