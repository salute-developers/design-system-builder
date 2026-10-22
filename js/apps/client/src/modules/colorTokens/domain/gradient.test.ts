import { describe, expect, it } from 'vitest';

import {
    colorField,
    deriveNative,
    formatNativeLayer,
    formatWebLayer,
    gradientColorAt,
    gradientLabel,
    parseNativeLayer,
    parseWebLayer,
    readPaint,
    rotatedConicStops,
    tokenNameFromLabel,
    validateColorValue,
    valueKind,
    withKind,
    writePaint,
    type GradientModel,
} from '.';

const resolve = (value: string) => (value.includes('missing') ? null : '#1A9E32FF');
const defaults = { angle: 90, from: 0, centerX: 50, centerY: 50, radius: 50 };

describe('web-градиент', () => {
    it('разбирает Linear, Radial и Conic по грамматике ds-service', () => {
        expect(parseWebLayer('linear-gradient(45.00deg, #1A9E32FF 0%, #04C6C9FF 99.688%)')).toEqual({
            ...defaults,
            type: 'linear',
            angle: 45,
            stops: [
                { color: '#1A9E32FF', position: 0 },
                { color: '#04C6C9FF', position: 99.688 },
            ],
        });
        expect(parseWebLayer('radial-gradient(70% 70% at 30% 40%, #1A9E32 0%, #04C6C9 100%)')).toMatchObject({
            type: 'radial',
            radius: 70,
            centerX: 30,
            centerY: 40,
        });
        expect(
            parseWebLayer('conic-gradient(from 90deg at 50% 50%, [general.green.500] 0%, #04C6C9FF 100%)'),
        ).toMatchObject({
            type: 'conic',
            from: 90,
            stops: [
                { color: '[general.green.500]', position: 0 },
                { color: '#04C6C9FF', position: 100 },
            ],
        });
        // Позиция из одной цифры и ссылка с прозрачностью.
        expect(parseWebLayer('linear-gradient(0deg, [general.green.500][0.5] 5%, #FFFFFF 9%)')?.stops).toEqual([
            { color: '[general.green.500][0.5]', position: 5 },
            { color: '#FFFFFF', position: 9 },
        ]);
    });

    it('не принимает формы вне грамматики', () => {
        for (const layer of [
            'linear-gradient(90deg, #FFFFFF 0%)',
            'linear-gradient(90deg, #FFFFFF 50%, #000000 10%)',
            'linear-gradient(90deg, #FFFFFF 0%, #000000 120%)',
            'linear-gradient(to right, #FFFFFF 0%, #000000 100%)',
            'linear-gradient(90deg, rgba(255, 255, 255, 0.09) 0%, #000000 100%)',
            'radial-gradient(50% 40% at 50% 50%, #FFFFFF 0%, #000000 100%)',
            'conic-gradient(90deg at 50% 50%, #FFFFFF 0%, #000000 100%)',
            '#FFFFFF',
        ])
            expect(parseWebLayer(layer)).toBeNull();
    });

    it('записывает модель трёх типов с упорядоченными стопами', () => {
        const stops = [
            { color: '#04C6C9', position: 100 },
            { color: '[general.green.500]', position: 0 },
        ];
        const model = { ...defaults, stops, type: 'linear' } satisfies GradientModel;
        expect(formatWebLayer(model)).toBe('linear-gradient(90deg, [general.green.500] 0%, #04C6C9 100%)');
        expect(formatWebLayer({ ...model, type: 'radial', radius: 70, centerX: 30, centerY: 40 })).toBe(
            'radial-gradient(70% 70% at 30% 40%, [general.green.500] 0%, #04C6C9 100%)',
        );
        expect(formatWebLayer({ ...model, type: 'conic', from: 45.5 })).toBe(
            'conic-gradient(from 45.5deg at 50% 50%, [general.green.500] 0%, #04C6C9 100%)',
        );
        const layer = formatWebLayer({ ...model, type: 'conic', from: 45.5 });
        expect(formatWebLayer(parseWebLayer(layer)!)).toBe(layer);
    });

    it('определяет вид значения', () => {
        expect(valueKind(['#FFFFFF'])).toBe('color');
        expect(valueKind(['[general.green.500][0.4]'])).toBe('color');
        expect(valueKind(['linear-gradient(90deg, #FFFFFF 0%, #000000 100%)', '#FFFFFF'])).toBe('gradient');
        expect(valueKind(['linear-gradient(to right, red, blue)'])).toBeNull();
        expect(valueKind(['blue'])).toBeNull();
        expect(valueKind([])).toBeNull();
    });

    it('подписывает градиент типом и углом', () => {
        const model = parseWebLayer('conic-gradient(from 30deg at 50% 50%, #FFFFFF 0%, #000000 100%)')!;
        expect(gradientLabel({ ...model, type: 'linear', angle: 45 })).toBe('Linear · 45°');
        expect(gradientLabel({ ...model, type: 'radial' })).toBe('Radial');
        expect(gradientLabel(model, 3)).toBe('Conic · 30° + ещё 2');
    });

    it('берёт цвет градиента в точке: стоп как есть, между стопами — интерполяция', () => {
        const stops = [
            { color: '#FF0000', position: 0 },
            { color: '[general.green.500]', position: 50 },
            { color: '#0000FF', position: 100 },
        ];
        expect(gradientColorAt(stops, 50, resolve)).toBe('[general.green.500]');
        expect(gradientColorAt([stops[0], stops[2]], 50)).toBe('#800080FF');
    });
});

describe('построение iOS и Android из web', () => {
    const linear = 'linear-gradient(45deg, #1A9E32 0%, [general.green.500] 100%)';

    it('цвет — тот же цвет или ссылка', () => {
        expect(deriveNative(['[general.green.500]'], 'ios')).toBe('[general.green.500]');
        expect(deriveNative(['#1A9E32'], 'android')).toBe('#1A9E32');
    });

    it('Linear и Radial — слои формата платформы', () => {
        expect(deriveNative([linear], 'ios')).toEqual([
            { kind: 'linear', locations: [0, 1], colors: ['#1A9E32FF', '[general.green.500]'], angle: 45 },
        ]);
        const radial = 'radial-gradient(70% 70% at 30% 40%, #1A9E32 0%, #04C6C9 100%)';
        expect(deriveNative([radial], 'ios')).toEqual([
            {
                kind: 'radial',
                locations: [0, 1],
                colors: ['#1A9E32FF', '#04C6C9FF'],
                centerX: 0.3,
                centerY: 0.4,
                startRadius: 0,
                endRadius: 0.7,
            },
        ]);
        expect(deriveNative([radial], 'android')).toEqual([
            {
                kind: 'radial',
                locations: [0, 1],
                colors: ['#1A9E32FF', '#04C6C9FF'],
                centerX: 0.3,
                centerY: 0.4,
                radius: 0.7,
            },
        ]);
        // Слой-цвет многослойного значения — слой `color`.
        expect(deriveNative([linear, '#FFFFFF'], 'android')[1]).toEqual({ kind: 'color', background: '#FFFFFFFF' });
    });

    it('Conic: на iOS угол как есть, на Android — сдвиг стопов с цветом шва', () => {
        const conic = 'conic-gradient(from 90deg at 25% 75%, #FF0000 0%, #0000FF 100%)';
        expect(deriveNative([conic], 'ios')).toEqual([
            {
                kind: 'angular',
                locations: [0, 1],
                colors: ['#FF0000FF', '#0000FFFF'],
                startAngle: 90,
                endAngle: 450,
                centerX: 0.25,
                centerY: 0.75,
            },
        ]);
        expect(deriveNative([conic], 'android')).toEqual([
            {
                kind: 'angular',
                locations: [0, 0.25, 0.25, 1],
                colors: ['#4000BFFF', '#0000FFFF', '#FF0000FF', '#4000BFFF'],
                centerX: 0.25,
                centerY: 0.75,
            },
        ]);
    });

    it('сдвиг стопов Conic: стоп в середине и нулевой угол', () => {
        const stops = [
            { color: '#000000', position: 0 },
            { color: '#FFFFFF', position: 50 },
            { color: '#000000', position: 100 },
        ];
        expect(rotatedConicStops(stops, 180)).toEqual([
            { color: '#FFFFFF', position: 0 },
            { color: '#FFFFFF', position: 0 },
            { color: '#000000', position: 50 },
            { color: '#000000', position: 50 },
            { color: '#FFFFFF', position: 100 },
        ]);
        expect(rotatedConicStops(stops, 360)).toEqual(stops);
    });

    it('разбирает слой платформы обратно в модель', () => {
        const model = parseWebLayer('radial-gradient(70% 70% at 30% 40%, #1A9E32 0%, #04C6C9 100%)')!;
        expect(parseNativeLayer(formatNativeLayer(model, 'ios'), 'ios')).toMatchObject({
            type: 'radial',
            radius: 70,
            centerX: 30,
            centerY: 40,
        });
        const conic = parseWebLayer('conic-gradient(from 30deg at 50% 50%, #1A9E32 0%, #04C6C9 100%)')!;
        // Своё значение Android: начального угла нет, стопы не сдвигаются.
        expect(formatNativeLayer(conic, 'android')).toEqual({
            kind: 'angular',
            locations: [0, 1],
            colors: ['#1A9E32FF', '#04C6C9FF'],
            centerX: 0.5,
            centerY: 0.5,
        });
        expect(parseNativeLayer(formatNativeLayer(conic, 'android'), 'android')).toMatchObject({ from: 0 });
        expect(parseNativeLayer(formatNativeLayer(conic, 'ios'), 'ios')).toMatchObject({ from: 30 });
        expect(
            parseNativeLayer(
                {
                    kind: 'radial',
                    locations: [0, 1],
                    colors: ['#000', '#FFF'],
                    centerX: 0.5,
                    centerY: 0.5,
                    startRadius: 0,
                    endRadius: 1,
                },
                'android',
            ),
        ).toBeNull();
    });
});

describe('вид значения в выборе цвета', () => {
    it('цвет → Linear 90° с текущим цветом и #F5F5F5, ссылка сохраняется', () => {
        const paint = withKind({ kind: 'color', color: '[general.green.500]' }, 'gradient');
        expect(writePaint(paint, 'web')).toEqual(['linear-gradient(90deg, [general.green.500] 0%, #F5F5F5 100%)']);
        expect(writePaint(withKind({ kind: 'color', color: '#1A9E32' }, 'gradient'), 'web')).toEqual([
            'linear-gradient(90deg, #1A9E32 0%, #F5F5F5 100%)',
        ]);
    });

    it('градиент → цвет первого стопа', () => {
        const paint = readPaint(['linear-gradient(45deg, [general.green.500][0.5] 0%, #FFFFFF 100%)'], 'web')!;
        expect(withKind(paint, 'color')).toEqual({ kind: 'color', color: '[general.green.500][0.5]' });
    });

    it('меняет только редактируемый слой и сохраняет остальные', () => {
        const value = [
            '#FFFFFF',
            'linear-gradient(45deg, #000000 0%, #FFFFFF 100%)',
            'linear-gradient(0deg, #111111 0%, #222222 100%)',
        ];
        const paint = readPaint(value, 'web');
        expect(paint).toMatchObject({ kind: 'gradient', index: 1 });
        if (paint?.kind !== 'gradient') return;
        expect(writePaint({ ...paint, model: { ...paint.model, angle: 10 } }, 'web')).toEqual([
            '#FFFFFF',
            'linear-gradient(10deg, #000000 0%, #FFFFFF 100%)',
            value[2],
        ]);
    });

    it('читает значения платформ: строку, слой color и слои градиента', () => {
        expect(readPaint('#1A9E32', 'ios')).toEqual({ kind: 'color', color: '#1A9E32' });
        expect(readPaint([{ kind: 'color', background: '#1A9E32FF' }], 'android')).toEqual({
            kind: 'color',
            color: '#1A9E32FF',
        });
        expect(
            readPaint([{ kind: 'linear', locations: [0, 1], colors: ['#000', '#FFF'], angle: 5 }], 'ios'),
        ).toMatchObject({
            kind: 'gradient',
            model: { type: 'linear', angle: 5 },
        });
        expect(readPaint([{ kind: 'unknown' }], 'ios')).toBeNull();
    });
});

describe('проверка значения в редакторе', () => {
    it('градиент по грамматике не ошибка, а остальное — ошибка', () => {
        const check = (value: unknown) => validateColorValue(colorField(value, 'dark.text.default.accent', resolve));
        expect(check(['linear-gradient(45.00deg, #1A9E32FF 0%, #04C6C9FF 99.688%)'])).toBeNull();
        expect(check(['conic-gradient(from 90deg at 50% 50%, [general.green.500] 0%, #04C6C9FF 100%)'])).toBeNull();
        expect(check(['linear-gradient(90deg, rgba(255, 255, 255, 0.09) 0%, #FFFFFF 100%)'])).toMatch(
            /^Введите градиент/,
        );
        expect(check('blue')).toMatch(/^Введите цвет/);
        expect(check(['linear-gradient(90deg, [general.missing.500] 0%, #FFFFFF 100%)'])).toBe(
            'Ступени Missing 500 нет в палитре темы.',
        );
    });

    it('проверяет строки своих значений платформ', () => {
        const field = colorField('#FFFFFF', 'dark.text.default.accent', resolve);
        const row = colorField([{ kind: 'radial' }], 'dark.text.default.accent', resolve, undefined, 'ios');
        expect(validateColorValue({ ...field, platforms: { ios: row } })).toMatch(/платформы/);
    });

    it('показывает градиент с раскрытыми ссылками стопов и цвет первого стопа', () => {
        const field = colorField(
            ['linear-gradient(45deg, [general.green.500] 0%, #FFFFFF 100%)'],
            'dark.text.default.accent',
            resolve,
        );
        expect(field).toMatchObject({
            kind: 'gradient',
            resolved: 'linear-gradient(45deg, #1A9E32FF 0%, #FFFFFF 100%)',
            baseColor: '#1A9E32FF',
        });
    });
});

describe('переименование на месте', () => {
    it('отбрасывает префикс группы отображаемого имени', () => {
        const taken = new Set(['text.accent']);
        expect(tokenNameFromLabel('textBrand', 'text', taken, true)).toEqual({ name: 'brand' });
        expect(tokenNameFromLabel('Brand', 'text', taken, true)).toEqual({ name: 'brand' });
        expect(tokenNameFromLabel('textAccent', 'text', taken, true)).toEqual({ error: 'Имя accent уже занято.' });
    });
});
