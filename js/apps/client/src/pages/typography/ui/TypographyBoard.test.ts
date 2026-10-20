import { describe, expect, it } from 'vitest';

import { bodyM } from '../../../modules/typographyTokens/testFixtures';
import { rowLayout } from './TypographyBoard';

const display = (size: string, sizePx: number, lineHeightPx: number) =>
    bodyM('screen-l', { group: 'display', size, sizePx, lineHeightPx });

describe('высота строк борда', () => {
    it('совпадает с прототипом при значениях темы по умолчанию', () => {
        expect(rowLayout(display('m', 88, 92))).toEqual([76, 76, 0]);
        expect(rowLayout(display('s', 64, 68))).toEqual([76, 63, 0]);
        expect(rowLayout(bodyM('screen-l', { group: 'header', size: 'h1', sizePx: 48, lineHeightPx: 54 }))).toEqual([
            70, 70, 0,
        ]);
        expect(rowLayout(bodyM('screen-l'))).toEqual([48, 48, 0]);
    });

    it('растёт, если буквы увеличенного стиля не помещаются', () => {
        expect(rowLayout(display('l', 200, 128))).toEqual([158, 158, 0]);
        expect(rowLayout(bodyM('screen-l', { sizePx: 96, lineHeightPx: 100 }))).toEqual([80, 80, 0]);
    });
});
