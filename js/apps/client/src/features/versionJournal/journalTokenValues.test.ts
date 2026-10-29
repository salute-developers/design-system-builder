import { describe, expect, it } from 'vitest';

import { deriveNative } from '../../modules/colorTokens/domain';
import { journalValueText } from './journalFields';
import {
    journalColor,
    journalPaintChange,
    journalPaintStructureChanged,
    journalTokenValue,
    journalValueStructureChanged,
} from './journalTokenValues';

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

describe('значения цветовых токенов в терминах редактора', () => {
    const conic = 'conic-gradient(from 0deg at 45% 50%, [general.green.400] 0%, [general.blue.500] 100%)';
    const linear = 'linear-gradient(45deg, #FFFFFF 0%, [general.teal.400] 100%)';
    const changed = 'linear-gradient(90deg, #FFFFFF 0%, [general.blue.500] 100%)';
    const web = (value: unknown) => ({ value, platform: 'web' as const });
    const ios = (value: unknown) => ({ value: deriveNative([value], 'ios'), platform: 'ios' as const });
    const rows = (fields: ReturnType<typeof journalPaintChange>) =>
        fields!.map(({ label, before, after, revertPaths }) => [label, before, after, revertPaths]);

    it('смену цвета на градиент показывает видом значения со свотчами без CSS и ссылок', () => {
        const [field, ...rest] = journalPaintChange(web(['[general.green.400]']), web([conic]))!;

        expect(rest).toEqual([]);
        expect(field.label).toBe('Вид значения');
        expect(journalValueText(field.before)).toBe('Green 400');
        expect(journalColor(field.before)).toMatch(/^#/);
        expect(journalValueText(field.after)).toBe('Конический · 0°');
        expect(journalColor(field.after)).toMatch(/^conic-gradient\(from 0deg at 45% 50%, #/);
        expect(journalColor(field.after)).not.toContain('[');
    });

    it('у двух градиентов показывает строки изменённых параметров и стопов под названиями редактора', () => {
        const fields = journalPaintChange(web([linear]), web([changed]), ['/value/0']);

        // У web слой — одна CSS-строка: параметр без своего пути отменяется только вместе с записью.
        expect(rows(fields)).toEqual([
            ['Угол', '45°', '90°', []],
            ['Стоп 2 · цвет', '[general.teal.400]', '[general.blue.500]', []],
        ]);
        expect(`${journalValueText(fields![1].before)} → ${journalValueText(fields![1].after)}`).toBe(
            'Teal 400 → Blue 500',
        );
        expect(rows(journalPaintChange(web([linear]), web([linear.replace('45deg', '90deg')]), ['/value/0']))).toEqual([
            ['Угол', '45°', '90°', ['/value/0']],
        ]);
    });

    it('параметр слоя платформы отменяется путями своих полей', () => {
        const fields = journalPaintChange(ios(linear), ios(changed), ['/value/0/angle', '/value/0/colors/1']);

        expect(rows(fields)).toEqual([
            ['Угол', '45°', '90°', ['/value/0/angle']],
            ['Стоп 2 · цвет', '[general.teal.400]', '[general.blue.500]', ['/value/0/colors/1']],
        ]);
    });

    it('смена вида, типа градиента или числа стопов меняет структуру значения', () => {
        const radial = 'radial-gradient(30% 30% at 45% 50%, [general.green.400] 0%, [general.blue.500] 100%)';
        const threeStops = 'linear-gradient(45deg, #FFFFFF 0%, #000000 50%, [general.teal.400] 100%)';

        expect(journalPaintStructureChanged(web(['[general.green.400]']), web([conic]))).toBe(true);
        expect(journalPaintStructureChanged(web([conic]), web([radial]))).toBe(true);
        expect(journalPaintStructureChanged(web([linear]), web([threeStops]))).toBe(true);
        expect(journalPaintStructureChanged(web([linear]), web([changed]))).toBe(false);
        expect(journalPaintStructureChanged(web(['#FFFFFF']), web(['[general.green.400]']))).toBe(false);
        expect(journalPaintStructureChanged(undefined, web([conic]))).toBe(false);
    });

    it('значение платформы показывает так же, как web, а не слоями хранимого значения', () => {
        const android = (value: unknown) => ({ value: [value].flat(), platform: 'android' as const });

        const [field] = journalPaintChange(
            android(deriveNative(['#2ACB47FF'], 'android')),
            android(deriveNative([conic], 'android')),
        )!;

        expect(field.label).toBe('Вид значения');
        expect(journalValueText(field.before)).toBe('#2ACB47FF');
        expect(journalValueText(field.after)).toBe('Конический · 0°');
        expect(journalPaintChange(android('#2ACB47FF'), android('#2ACB47FF'))).toEqual([]);
        expect(rows(journalPaintChange(android('#2ACB47FF'), android('#000000FF'), ['/value/0']))).toEqual([
            ['Цвет', '#2ACB47FF', '#000000FF', ['/value/0']],
        ]);
    });

    it('не цвет и не градиент оставляет представлению по параметрам хранимого значения', () => {
        expect(journalPaintChange(web(['red', 'blue']), web([conic]))).toBeNull();
        expect(journalPaintChange(web(null), web(['[general.green.600]']))).toBeNull();
    });
});
