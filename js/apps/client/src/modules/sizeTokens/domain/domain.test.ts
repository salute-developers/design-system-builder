import { describe, expect, it } from 'vitest';

import {
    buildSections,
    colorWithOpacity,
    cssLayer,
    defaultToken,
    deletedTogether,
    differingPlatforms,
    kindOfThemeToken,
    newShadowVariants,
    newTokenRequest,
    normalizeTokenName,
    opacityOf,
    parseCssLayer,
    shortName,
    spacingNameFromValue,
    themeModelValue,
    themeValuesFromToken,
    toRem,
    validateLayers,
    validatePx,
    withValue,
    RANGES,
    type DimensionToken,
    type ShadowLayer,
    type ShadowToken,
    type SizeToken,
} from '.';

const dimension = (
    kind: 'radius' | 'spacing',
    name: string,
    valuePx: number | null,
    extra: Partial<DimensionToken> = {},
): DimensionToken => ({
    kind,
    tokenId: `id-${name}`,
    name,
    valuePx,
    fullRounding: name === 'round.circle',
    platforms: {},
    native: { ios: valuePx, android: valuePx },
    platformsDiffer: false,
    components: [],
    derived: [],
    ...extra,
});

const layer = (offsetY: number, blur: number, color = '#00000014'): ShadowLayer => ({
    offsetX: 0,
    offsetY,
    blur,
    spread: -4,
    color,
});

const shadow = (name: string, layers: ShadowLayer[], extra: Partial<ShadowToken> = {}): ShadowToken => ({
    kind: 'shadow',
    tokenId: `id-${name}`,
    name,
    layers,
    fallbackElevation: 2,
    platforms: {},
    native: { ios: { layers }, android: { layers } },
    platformsDiffer: false,
    components: [],
    ...extra,
});

const TOKENS: SizeToken[] = [
    dimension('radius', 'round.circle', null),
    dimension('radius', 'round.l', 16),
    dimension('radius', 'round.m', 12),
    dimension('radius', 'round.xxs', 4),
    dimension('spacing', 'spacing.4x', 8),
    dimension('spacing', 'spacing.0x', 0),
    shadow('up.hard.s', [layer(-4, 14)]),
    shadow('down.soft.m', [layer(8, 24)]),
    shadow('down.soft.s', [layer(4, 14), layer(1, 4)]),
    shadow('down.hard.l', [layer(24, 48, '#00000029')], { fallbackElevation: 6 }),
    shadow('down.soft.l', [layer(60, 112)], { fallbackElevation: 6 }),
];

describe('имена токенов размеров', () => {
    it('берёт в раздел только токены с именем по правилу своего типа', () => {
        expect(kindOfThemeToken('shape', 'round.m')).toBe('radius');
        expect(kindOfThemeToken('spacing', 'spacing.4x')).toBe('spacing');
        expect(kindOfThemeToken('shadow', 'down.soft.s')).toBe('shadow');
        expect(kindOfThemeToken('shape', 'corner.m')).toBeNull();
        expect(kindOfThemeToken('shadow', 'left.soft.s')).toBeNull();
        expect(kindOfThemeToken('color', 'round.m')).toBeNull();
    });

    it('показывает короткие имена как в дереве прототипа', () => {
        expect(shortName(dimension('radius', 'round.m', 12))).toBe('M');
        expect(shortName(dimension('radius', 'round.circle', null))).toBe('Circle');
        expect(shortName(dimension('radius', 'round.xxxl', 40))).toBe('XXXL');
        expect(shortName(dimension('spacing', 'spacing.4x', 8))).toBe('4x');
        expect(shortName(shadow('down.soft.s', []))).toBe('Down Soft S');
    });

    it('приводит имя нового токена к нижнему регистру через дефис', () => {
        expect(normalizeTokenName(' XXXL ')).toBe('xxxl');
        expect(normalizeTokenName('Extra Large_2')).toBe('extra-large-2');
        expect(normalizeTokenName('радиус')).toBe('');
    });

    it('подставляет имя отступа по значению только для чётного целого', () => {
        expect(spacingNameFromValue('28')).toBe('14x');
        expect(spacingNameFromValue('27')).toBe('');
        expect(spacingNameFromValue('abc')).toBe('');
    });
});

describe('дерево раздела', () => {
    it('сортирует радиусы и отступы по значению с полным скруглением последним, тени — по варианту и размеру', () => {
        const [radii, spacing, shadows] = buildSections(TOKENS);
        expect(radii.label).toBe('Радиусы');
        expect(radii.tokens.map((token) => token.name)).toEqual(['round.xxs', 'round.m', 'round.l', 'round.circle']);
        expect(spacing.tokens.map((token) => token.name)).toEqual(['spacing.0x', 'spacing.4x']);
        expect(shadows.tokens.map((token) => token.name)).toEqual([
            'down.soft.s',
            'down.soft.m',
            'down.soft.l',
            'down.hard.l',
            'up.hard.s',
        ]);
    });

    it('ищет по имени без учёта регистра', () => {
        const sections = buildSections(TOKENS, 'SOFT.S');
        expect(sections.flatMap((section) => section.tokens.map((token) => token.name))).toEqual(['down.soft.s']);
    });

    it('выбирает round.m по умолчанию, а без него — первый радиус', () => {
        expect(defaultToken(TOKENS)?.name).toBe('round.m');
        expect(defaultToken(TOKENS.filter((token) => token.name !== 'round.m'))?.name).toBe('round.xxs');
    });

    it('удаляет тень размером целиком', () => {
        const all = [...TOKENS, shadow('down.hard.s', []), shadow('up.soft.s', [])];
        expect(
            deletedTogether(all, all.find((token) => token.name === 'up.hard.s')!).map((token) => token.name),
        ).toEqual(['down.soft.s', 'down.hard.s', 'up.soft.s', 'up.hard.s']);
    });
});

describe('окно «Новый токен»', () => {
    it('создаёт радиус и отступ по имени и значению', () => {
        expect(newTokenRequest({ kind: 'radius', name: 'XXXL', value: '40' }, TOKENS)).toEqual({
            request: { kind: 'radius', name: 'xxxl', valuePx: 40 },
        });
        expect(newTokenRequest({ kind: 'spacing', name: '14x', value: '28' }, TOKENS)).toEqual({
            request: { kind: 'spacing', name: '14x', valuePx: 28 },
        });
    });

    it('отклоняет пустое и занятое имя и неверное значение текстами спеки', () => {
        expect(newTokenRequest({ kind: 'radius', name: '  ', value: '4' }, TOKENS)).toEqual({
            error: 'Введите имя токена: латиница и цифры.',
        });
        expect(newTokenRequest({ kind: 'radius', name: 'M', value: '4' }, TOKENS)).toEqual({
            error: 'Токен round.m уже есть в теме.',
        });
        expect(newTokenRequest({ kind: 'shadow', name: 'l', value: '' }, TOKENS)).toEqual({
            error: 'Токен down.soft.l уже есть в теме.',
        });
        expect(newTokenRequest({ kind: 'spacing', name: '70x', value: '140' }, TOKENS)).toEqual({
            error: 'Значение должно быть в диапазоне 0–128 px.',
        });
    });

    it('копирует слои новой тени с самого крупного размера каждого варианта', () => {
        const variants = newShadowVariants(TOKENS);
        expect(variants.map((item) => item.variant)).toEqual(['down.soft', 'down.hard', 'up.soft', 'up.hard']);
        expect(variants[0]).toMatchObject({ layers: [layer(60, 112)], fallbackElevation: 6 });
        expect(variants[1]).toMatchObject({ layers: [layer(24, 48, '#00000029')], fallbackElevation: 6 });
        expect(variants[2].layers).toHaveLength(1);
        expect(variants[3]).toMatchObject({ layers: [layer(-4, 14)] });
        // Копия: правка новой тени не меняет источник.
        variants[0].layers[0].blur = 1;
        expect((TOKENS.find((token) => token.name === 'down.soft.l') as ShadowToken).layers[0].blur).toBe(112);
    });
});

describe('проверка значений', () => {
    it('возвращает тексты таблицы design.md', () => {
        expect(validatePx('', RANGES.radius)).toBe('Значение не может быть пустым.');
        expect(validatePx('abc', RANGES.radius)).toBe('Размер должен быть числом.');
        expect(validatePx('12.5', RANGES.radius)).toBe('Размер должен быть целым числом.');
        expect(validatePx('1200', RANGES.radius)).toBe('Значение должно быть в диапазоне 0–1000 px.');
        expect(validatePx('-201', RANGES.offset)).toBe('Значение должно быть в диапазоне -200–200 px.');
        expect(validatePx('25', RANGES.elevation)).toBe('Значение должно быть в диапазоне 0–24 px.');
        expect(validatePx('12', RANGES.radius)).toBeNull();
    });

    it('проверяет слои тени', () => {
        expect(validateLayers([])).toBe('У тени должен быть хотя бы один слой.');
        expect(validateLayers(Array.from({ length: 5 }, () => layer(1, 1)))).toBe('У тени не больше 4 слоёв.');
        expect(validateLayers([{ ...layer(1, 1), color: 'red' }])).toBe('Цвет должен быть в формате Hex.');
        expect(validateLayers([layer(1, 1)])).toBeNull();
    });

    it('записывает цвет слоя с прозрачностью как #RRGGBBAA', () => {
        expect(colorWithOpacity('#000000', 24)).toBe('#0000003D');
        expect(colorWithOpacity('#abcdef', 100)).toBe('#ABCDEFFF');
        expect(opacityOf('#0000003D')).toBe(24);
        expect(opacityOf('#000000')).toBe(100);
    });
});

describe('значения платформ', () => {
    it('разбирает и собирает CSS-строку слоя тени в rem без лишних нулей', () => {
        const parsed = parseCssLayer('0rem 0.25rem 0.875rem -0.25rem #08080814');
        expect(parsed).toEqual({ offsetX: 0, offsetY: 4, blur: 14, spread: -4, color: '#08080814' });
        expect(cssLayer(parsed)).toBe('0rem 0.25rem 0.875rem -0.25rem #08080814');
        expect(toRem(12)).toBe('0.75rem');
        expect(toRem(0)).toBe('0rem');
    });

    it('находит платформы, которые расходятся с вебом без своего значения', () => {
        const xxl = dimension('radius', 'round.xxl', 32, { native: { ios: 40, android: 40 }, platformsDiffer: true });
        expect(differingPlatforms(xxl)).toEqual(['ios', 'android']);
        expect(differingPlatforms({ ...xxl, platforms: { ios: 40 } })).toEqual(['android']);
        expect(
            differingPlatforms(dimension('radius', 'round.circle', null, { native: { ios: 9999, android: 9999 } })),
        ).toEqual([]);
        const own = shadow('down.hard.m', [layer(1, 2)], { native: { ios: { layers: [layer(3, 4)] }, android: null } });
        expect(differingPlatforms(own)).toEqual(['ios']);
    });

    it('накладывает несохранённое значение на токен', () => {
        const token = dimension('radius', 'round.l', 16);
        expect(withValue(token, { kind: 'dimension', valuePx: 20, platforms: { android: 18 } })).toMatchObject({
            valuePx: 20,
            platforms: { android: 18 },
        });
        const shadowToken = shadow('down.hard.m', [layer(1, 2)]);
        expect(
            withValue(shadowToken, {
                kind: 'shadow',
                layers: [layer(5, 6)],
                fallbackElevation: 4,
                platforms: { ios: [layer(7, 8)] },
            }),
        ).toMatchObject({ layers: [layer(5, 6)], fallbackElevation: 4, platforms: { ios: { layers: [layer(7, 8)] } } });
    });

    it('строит значения модели темы по токену', () => {
        expect(themeValuesFromToken(dimension('radius', 'round.m', 12, { platforms: { android: 14 } }))).toEqual({
            web: '0.75rem',
            ios: { kind: 'round', cornerRadius: 12 },
            android: { kind: 'round', cornerRadius: 14 },
        });
        expect(themeValuesFromToken(dimension('spacing', 'spacing.4x', 8))?.android).toEqual({ value: 8 });
        expect(themeValuesFromToken(dimension('radius', 'round.circle', null))).toBeNull();
        const values = themeValuesFromToken(shadow('down.soft.s', [layer(4, 14), layer(1, 4)]))!;
        expect(values.web).toEqual([
            '0rem 0.25rem 0.875rem -0.25rem #00000014',
            '0rem 0.0625rem 0.25rem -0.25rem #00000014',
        ]);
        expect((values.android as Array<{ fallbackElevation: number }>).map((item) => item.fallbackElevation)).toEqual([
            2, 0,
        ]);
        expect((values.ios as object[])[0]).not.toHaveProperty('fallbackElevation');
    });

    it('хранит в модели темы тень массивом, а остальное — одним значением', () => {
        expect(themeModelValue('radius', ['0.75rem'])).toBe('0.75rem');
        expect(themeModelValue('shadow', ['a'])).toEqual(['a']);
    });
});
