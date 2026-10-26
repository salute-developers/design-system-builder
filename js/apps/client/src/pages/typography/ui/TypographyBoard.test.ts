import { describe, expect, it } from 'vitest';

import { bodyM } from '../../../modules/typographyTokens/testFixtures';
import { rowLayout, sampleStyle } from './TypographyBoard';

const display = (size: string, sizePx: number, lineHeightPx: number) =>
    bodyM('screen-l', { group: 'display', size, sizePx, lineHeightPx, fontFamily: 'display' });

describe('высота строк борда', () => {
    it('совпадает с прототипом, если строка стиля помещается в образец', () => {
        expect(rowLayout(display('m', 88, 72))).toEqual([76, 76, 0]);
        expect(rowLayout(display('s', 64, 60))).toEqual([76, 63, 0]);
        expect(rowLayout(bodyM('screen-l', { group: 'header', size: 'h1', sizePx: 48, lineHeightPx: 54 }))).toEqual([
            70, 70, 0,
        ]);
        expect(rowLayout(bodyM('screen-l'))).toEqual([48, 48, 0]);
    });

    it('растёт до высоты строки стиля, если она выше образца прототипа', () => {
        expect(rowLayout(display('l', 128, 128))).toEqual([128, 128, 0]);
        expect(rowLayout(display('s', 64, 68))).toEqual([81, 68, 0]);
        expect(rowLayout(display('l', 160, 50))).toEqual([76, 76, 0]);
        expect(rowLayout(bodyM('screen-l', { sizePx: 96, lineHeightPx: 100 }))).toEqual([100, 100, 0]);
    });

    it('образец обрезается по высоте строки стиля', () => {
        const style = sampleStyle([{ name: 'display', fontName: 'SB Sans Display' }], display('l', 160, 50));
        expect(style).toMatchObject({ fontSize: '160px', lineHeight: '50px', height: '50px' });
        expect(style.fontFamily).toBe("'SB Sans Display', sans-serif");
    });

    it('образец рисуется весом выбранного начертания, без него у стиля — первым из имеющихся', () => {
        const style = bodyM('screen-l');
        expect(sampleStyle([], style).fontWeight).toBe(400);
        expect(sampleStyle([], style, 'bold').fontWeight).toBe(600);
        const withoutBold = { ...style, variants: { medium: style.variants.medium } };
        expect(sampleStyle([], withoutBold, 'bold').fontWeight).toBe(500);
    });
});
