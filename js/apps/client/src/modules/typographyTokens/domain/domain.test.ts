import { describe, expect, it } from 'vitest';

import { bodyM, typographyStyles } from '../testFixtures';
import {
    applyStyleChange,
    applyUpdatedStyle,
    groupStyles,
    mergeChanges,
    parseNumber,
    screenStyles,
    styleLabel,
    validateChange,
    TYPOGRAPHY_MESSAGES,
} from '.';

describe('домен стилей типографии', () => {
    it('называет стили как прототип', () => {
        expect(styleLabel({ group: 'body', size: 'm' })).toBe('Body M');
        expect(styleLabel({ group: 'header', size: 'h1' })).toBe('H1');
        expect(styleLabel({ group: 'display', size: 'l' })).toBe('Display L');
    });

    it('группирует стили в порядке прототипа и ищет по группе и названию', () => {
        const styles = screenStyles(typographyStyles(), 'screen-l');
        expect(groupStyles(styles).map((group) => group.label)).toEqual(['Header', 'Body']);
        expect(groupStyles(styles, 'body m').map((group) => group.styles.map(styleLabel))).toEqual([['Body M']]);
        expect(groupStyles(styles, 'HEADER')[0].styles.map(styleLabel)).toEqual(['H1']);
        expect(groupStyles(styles, 'нет')).toEqual([]);
    });

    it('объединяет правки: поздние значения заменяют ранние, веса объединяются', () => {
        expect(mergeChanges({ size: 16, weights: { bold: 600 } }, { size: 18, weights: { normal: 300 } })).toEqual({
            size: 18,
            weights: { bold: 600, normal: 300 },
        });
    });

    it('применяет размеры к экрану правки, а вес и семейство — ко всем экранам', () => {
        const next = applyStyleChange(typographyStyles(), 'body.m', 'screen-l', {
            size: 18,
            weights: { bold: 700 },
            fontFamily: 'display',
        });
        const [large, medium, small] = (['screen-l', 'screen-m', 'screen-s'] as const).map(
            (screen) => screenStyles(next, screen).find((style) => style.group === 'body')!,
        );
        expect(large.sizePx).toBe(18);
        expect(medium.sizePx).toBe(16);
        expect(small.sizePx).toBe(14);
        [large, medium, small].forEach((style) => {
            expect(style.variants.bold?.weight).toBe(700);
            expect(style.fontFamily).toBe('display');
        });
    });

    it('ответ изменения заменяет стиль экрана и переносит вес и семейство на другие экраны', () => {
        const response = bodyM('screen-m', { sizePx: 17, fontFamily: 'display' });
        response.variants.bold = { tokenId: 'screen-m.body.m.bold', weight: 700 };
        const next = applyUpdatedStyle(typographyStyles(), response, {
            size: 17,
            fontFamily: 'display',
            weights: { bold: 700 },
        });
        expect(screenStyles(next, 'screen-m').find((style) => style.group === 'body')).toBe(response);
        const large = screenStyles(next, 'screen-l').find((style) => style.group === 'body')!;
        expect(large.sizePx).toBe(16);
        expect(large.fontFamily).toBe('display');
        expect(large.variants.bold?.weight).toBe(700);
    });

    it('проверяет значения по правилам прототипа и сервера', () => {
        expect(validateChange({ size: -5 })).toEqual({ field: 'size', message: TYPOGRAPHY_MESSAGES.size });
        expect(validateChange({ lineHeight: 0 })?.field).toBe('lineHeight');
        expect(validateChange({ letterSpacing: 1.5 })?.message).toBe(TYPOGRAPHY_MESSAGES.letterSpacing);
        expect(validateChange({ weights: { medium: 450 } })).toEqual({
            field: 'weights.medium',
            message: TYPOGRAPHY_MESSAGES.weight,
        });
        expect(validateChange({ size: 18, letterSpacing: -0.2, weights: { bold: 900 } })).toBeNull();
    });

    it('разбирает числа поля ввода', () => {
        expect(parseNumber('16,5')).toBe(16.5);
        expect(parseNumber(' -0.02 ')).toBe(-0.02);
        expect(parseNumber('abc')).toBeNull();
        expect(parseNumber('')).toBeNull();
    });
});
