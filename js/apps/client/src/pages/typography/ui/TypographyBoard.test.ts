import { describe, expect, it } from 'vitest';

import { bodyM } from '../../../modules/typographyTokens/testFixtures';
import { rowHeight, sampleStyle } from './TypographyBoard';

const display = (size: string, sizePx: number, lineHeightPx: number) =>
    bodyM('screen-l', { group: 'display', size, sizePx, lineHeightPx, fontFamily: 'display' });

describe('высота строк борда', () => {
    it('не меньше 100 px по Figma', () => {
        expect(rowHeight(display('m', 88, 72))).toBe(100);
        expect(rowHeight(bodyM('screen-l'))).toBe(100);
        expect(rowHeight(display('l', 160, 50))).toBe(100);
    });

    it('растёт вместе с высотой строки стиля и отступами карточки образца', () => {
        expect(rowHeight(display('l', 128, 128))).toBe(152);
        expect(rowHeight(bodyM('screen-l', { sizePx: 96, lineHeightPx: 100 }))).toBe(124);
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
