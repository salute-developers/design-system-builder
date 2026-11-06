import { describe, expect, it } from 'vitest';

import { buildSnapshot, groupBy, parsePaint, searchByName } from './snapshot';

describe('разбор значения цвета', () => {
    it('распознаёт цвет, градиент и пустое значение', () => {
        expect(parsePaint(['#112233'])).toEqual({ kind: 'color', css: '#112233' });
        expect(parsePaint(['#11223344'])).toEqual({ kind: 'color', css: '#11223344' });
        expect(parsePaint(['linear-gradient(90deg, #000, #fff)', 'radial-gradient(#000, #fff)'])).toEqual({
            kind: 'gradient',
            css: 'linear-gradient(90deg, #000, #fff), radial-gradient(#000, #fff)',
        });
        expect(parsePaint(['#FFFFFF80', 'linear-gradient(90deg, #FFFFFF 0%, #000000 100%)'])).toEqual({
            kind: 'gradient',
            css: 'linear-gradient(#FFFFFF80, #FFFFFF80), linear-gradient(90deg, #FFFFFF 0%, #000000 100%)',
        });
        expect(parsePaint(undefined)).toEqual({ kind: 'empty' });
        expect(parsePaint([])).toEqual({ kind: 'empty' });
    });

    it('показывает нераспознанное значение как есть, а не падает', () => {
        expect(parsePaint(['[general.gray.900][0.16]'])).toEqual({
            kind: 'unknown',
            raw: '["[general.gray.900][0.16]"]',
        });
        expect(parsePaint(['[general.gray.900][0.16]', 'linear-gradient(#000, #fff)']).kind).toBe('unknown');
        expect(parsePaint({ a: 1 })).toEqual({ kind: 'unknown', raw: '{"a":1}' });
    });
});

describe('снимок темы', () => {
    const snapshot = buildSnapshot({
        tokens: [
            { id: 'a', name: 'text.default.accent', type: 'color', displayName: 'Accent', enabled: true },
            { id: 'b', name: 'surface.default.fill', type: 'gradient', enabled: true },
            { id: 'c', name: 'text.default.off', type: 'color', enabled: false },
            { id: 'd', name: 'round.m', type: 'shape', enabled: true },
        ],
        values: [
            { tokenId: 'a', platform: 'web', mode: 'light', value: ['#000000'] },
            { tokenId: 'a', platform: 'web', mode: 'dark', value: ['#ffffff'] },
            { tokenId: 'a', platform: 'ios', mode: 'light', value: ['#111111'] },
            { tokenId: 'b', platform: 'web', mode: null, value: ['linear-gradient(#000, #fff)'] },
        ],
        typography: {
            families: [{ name: 'body', fontName: 'SB Sans Text' }],
            screens: [
                {
                    screen: 'screen-l',
                    styles: [
                        {
                            group: 'body',
                            size: 'm',
                            sizePx: 16,
                            lineHeightPx: 20,
                            letterSpacingEm: 0,
                            fontFamily: 'body',
                            variants: { normal: { tokenId: 't1', weight: 400 }, bold: { tokenId: 't2', weight: 600 } },
                        },
                        {
                            group: 'caption',
                            size: 'promo-title',
                            sizePx: 12,
                            lineHeightPx: 16,
                            letterSpacingEm: 0,
                            fontFamily: 'caption',
                            variants: { normal: { tokenId: 't3', weight: 400 } },
                        },
                    ],
                },
            ],
        },
        sizes: {
            radii: [
                { tokenId: 'r', name: 'round.m', valuePx: 8 },
                { tokenId: 'c', name: 'round.circle', valuePx: null, fullRounding: true },
            ],
            spacing: [{ tokenId: 's', name: 'spacing.4x', valuePx: 16 }],
            shadows: [
                {
                    tokenId: 'h',
                    name: 'card',
                    layers: [{ offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: '#00000033' }],
                },
            ],
        },
    });

    it('берёт значения веба выбранного режима и скрывает выключенные токены', () => {
        expect(snapshot.colors.map(({ id }) => id)).toEqual(['a', 'b']);
        expect(snapshot.colors[0]).toMatchObject({
            label: 'Accent',
            group: 'text',
            light: { kind: 'color', css: '#000000' },
            dark: { kind: 'color', css: '#ffffff' },
        });
    });

    it('значение без режима подходит обоим режимам', () => {
        expect(snapshot.colors[1].light).toEqual(snapshot.colors[1].dark);
        expect(snapshot.colors[1].light.kind).toBe('gradient');
    });

    it('собирает типографику с весами и именем шрифта', () => {
        expect(snapshot.typography[0].styles[0]).toMatchObject({
            name: 'body.m',
            label: 'M',
            weights: [400, 600],
            fontName: 'SB Sans Text',
        });
        expect(snapshot.typography[0].styles[1]).toMatchObject({ label: 'promo-title', fontName: 'caption' });
    });

    it('передаёт размеры и тени', () => {
        expect(snapshot.radii[1]).toMatchObject({ valuePx: null, fullRounding: true });
        expect(snapshot.spacing[0].valuePx).toBe(16);
        expect(snapshot.shadows[0].layers[0].blur).toBe(4);
    });
});

describe('поиск и группы', () => {
    const items = [
        { name: 'text.accent', label: 'Accent', group: 'text' },
        { name: 'accent.fill', label: 'Fill', group: 'accent' },
        { name: 'surface.solid', label: 'Solid', group: 'surface' },
    ];

    it('ищет без учёта регистра и ставит совпадения с начала имени первыми', () => {
        expect(searchByName(items, 'ACCENT').map(({ name }) => name)).toEqual(['text.accent', 'accent.fill']);
        expect(searchByName(items, 'xent')).toEqual([]);
        expect(searchByName(items, ' ')).toEqual(items);
    });

    it('сохраняет порядок групп', () => {
        expect(groupBy(items).map(({ group }) => group)).toEqual(['text', 'accent', 'surface']);
    });
});
