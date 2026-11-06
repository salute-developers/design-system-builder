import { describe, expect, it } from 'vitest';

import { bodyM, typographyStyles } from '../testFixtures';
import {
    applyStyleChange,
    applyUpdatedStyle,
    groupNameRequest,
    groupStyles,
    lineHeightWarning,
    normalizeStyleSize,
    mergeChanges,
    parseNumber,
    screenGroups,
    screenStyles,
    styleLabel,
    styleSizeRequest,
    styleTitle,
    validateChange,
    TYPOGRAPHY_MESSAGES,
} from '.';

describe('домен стилей типографии', () => {
    it('называет стиль его именем в группе, как радиус, а полное название — с группой', () => {
        expect(styleLabel({ size: 'm' })).toBe('M');
        expect(styleLabel({ size: 'h1' })).toBe('H1');
        expect(styleLabel({ size: 'xxl' })).toBe('XXL');
        expect(styleLabel({ size: 'promo-title' })).toBe('promo-title');
        expect(styleTitle({ group: 'body', size: 'm' })).toBe('Body M');
        expect(styleTitle({ group: 'caption', size: 'promo-title' })).toBe('Caption promo-title');
    });

    it('разбирает произвольное имя стиля и имя своей группы', () => {
        expect(normalizeStyleSize(' Promo  Title ')).toBe('promo-title');
        expect(normalizeStyleSize('--x_l--')).toBe('xl');
        const styles = [{ group: 'body', size: 'm' }];
        expect(styleSizeRequest('body', 'M', styles)).toEqual({ error: 'Стиль Body M уже есть в теме.' });
        expect(styleSizeRequest('body', 'm', styles, 'body.m')).toEqual({ size: 'm' });
        expect(groupNameRequest('Caption', [])).toEqual({ name: 'caption' });
        expect(groupNameRequest('dspl', [])).toHaveProperty('error');
        expect(groupNameRequest('body', [])).toEqual({ error: 'Группа Body уже есть в теме.' });
        expect(groupNameRequest('note', ['note'])).toHaveProperty('error');
        expect(groupNameRequest('note', ['note'], 'note')).toEqual({ name: 'note' });
        expect(groupNameRequest('123', [])).toHaveProperty('error');
    });

    it('группирует стили в порядке прототипа и ищет по группе и названию', () => {
        const styles = screenStyles(typographyStyles(), 'screen-l');
        expect(groupStyles(styles).map((group) => group.label)).toEqual(['Header', 'Body']);
        expect(groupStyles(styles, 'body m').map((group) => group.styles.map(styleTitle))).toEqual([['Body M']]);
        expect(groupStyles(styles, 'HEADER')[0].styles.map(styleLabel)).toEqual(['H1']);
        expect(groupStyles(styles, 'нет')).toEqual([]);
    });

    it('показывает группы прототипа без стилей как ненастроенные, а пустой экран — без групп', () => {
        const styles = screenStyles(typographyStyles(), 'screen-l');
        expect(screenGroups(styles).map((group) => [group.label, group.styles.length])).toEqual([
            ['Display', 0],
            ['Header', 1],
            ['Body', 1],
            ['Text', 0],
        ]);
        expect(screenGroups([])).toEqual([]);
    });

    it('предупреждает, если высота строки меньше размера шрифта', () => {
        expect(lineHeightWarning(16, 14)).toBe(TYPOGRAPHY_MESSAGES.lineHeightBelowSize);
        expect(lineHeightWarning(16, 16)).toBeNull();
        expect(lineHeightWarning(16, -1)).toBeNull();
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
        const response = bodyM('screen-m', { sizePx: 17, fontFamily: 'display', components: [] });
        response.variants.bold = { tokenId: 'screen-m.body.m.bold', weight: 700 };
        const next = applyUpdatedStyle(typographyStyles(), response, {
            size: 17,
            fontFamily: 'display',
            weights: { bold: 700 },
        });
        const medium = screenStyles(next, 'screen-m').find((style) => style.group === 'body')!;
        expect(medium).toEqual({ ...response, components: bodyM('screen-m').components });
        const large = screenStyles(next, 'screen-l').find((style) => style.group === 'body')!;
        expect(large.sizePx).toBe(16);
        expect(large.fontFamily).toBe('display');
        expect(large.variants.bold?.weight).toBe(700);
    });

    it('своё значение платформы меняет только её, а значение, равное вебу, снимается', () => {
        const ios = applyStyleChange(typographyStyles(), 'body.m', 'screen-l', {
            platform: 'ios',
            size: 17,
            weights: { bold: 700 },
        });
        const large = screenStyles(ios, 'screen-l').find((style) => style.group === 'body')!;
        expect(large.sizePx).toBe(16);
        expect(large.overrides).toEqual({ ios: { sizePx: 17, weights: { bold: 700 } } });
        const medium = screenStyles(ios, 'screen-m').find((style) => style.group === 'body')!;
        expect(medium.overrides).toEqual({ ios: { weights: { bold: 700 } } });

        // Правка веба не трогает своё значение iOS; совпавшее с вебом снова строится из веба.
        const web = applyStyleChange(ios, 'body.m', 'screen-l', { size: 17 });
        expect(screenStyles(web, 'screen-l').find((style) => style.group === 'body')!.overrides).toEqual({
            ios: { weights: { bold: 700 } },
        });
        const reset = applyStyleChange(ios, 'body.m', 'screen-l', { platform: 'ios', weights: { bold: 600 } });
        expect(screenStyles(reset, 'screen-l').find((style) => style.group === 'body')!.overrides).toEqual({
            ios: { sizePx: 17 },
        });
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
