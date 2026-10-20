import { describe, expect, it } from 'vitest';

import { AndroidShape, IOSShape, ShapeToken, Theme, WebShape } from '../../../controllers';
import type { DimensionToken, ShadowToken, SizeToken } from '../domain';
import { legacyDraftOperations, legacySizeEntries } from './legacyDraft';
import { applyToTheme, removeFromTheme } from './themeModel';

const radius = (name: string, valuePx: number, extra: Partial<DimensionToken> = {}): DimensionToken => ({
    kind: 'radius',
    tokenId: `id-${name}`,
    name,
    valuePx,
    fullRounding: false,
    platforms: {},
    native: { ios: valuePx, android: valuePx },
    platformsDiffer: false,
    components: [],
    derived: [],
    ...extra,
});

const shadow = (name: string): ShadowToken => {
    const layers = [{ offsetX: 0, offsetY: 8, blur: 24, spread: -4, color: '#00000014' }];
    return {
        kind: 'shadow',
        tokenId: `id-${name}`,
        name,
        layers,
        fallbackElevation: 4,
        platforms: {},
        native: { ios: { layers }, android: { layers } },
        platformsDiffer: false,
        components: [],
    };
};

const SERVER: SizeToken[] = [
    radius('round.l', 16, { platforms: { android: 18 } }),
    shadow('down.soft.m'),
    shadow('down.hard.m'),
    shadow('up.soft.m'),
    shadow('up.hard.m'),
];

const DRAFT: Record<string, { web: unknown; android?: unknown }> = {
    'round.l': { web: '1.25rem' },
    'round.xxxl': { web: '2.5rem' },
    'spacing.14x': { web: '1.75rem' },
    'down.soft.m': {
        web: ['0rem 0.5rem 1rem 0rem #0000003D'],
        android: [
            { color: '#0000003D', offsetX: 0, offsetY: 8, blurRadius: 16, spreadRadius: 0, fallbackElevation: 5 },
        ],
    },
    'down.hard.xl': { web: ['0rem 1rem 2rem 0rem #00000029'] },
};

const value = (name: string, _type: string, platform: 'web' | 'android') => DRAFT[name]?.[platform];

describe('перенос прежнего черновика', () => {
    it('берёт только записи радиусов, отступов и теней с именем по правилу', () => {
        expect(
            legacySizeEntries([
                { name: 'round.l', type: 'shape' },
                { name: 'corner.x', type: 'shape' },
                { name: 'dark.text.default.accent', type: 'color' },
                { name: 'spacing.4x', type: 'spacing' },
            ]).map((entry) => entry.name),
        ).toEqual(['round.l', 'spacing.4x']);
    });

    it('переводит записи через значения на вебе: изменения существующих и создание новых токенов', () => {
        const entries = Object.keys(DRAFT).map((name) => ({
            name,
            type: name.startsWith('round') ? 'shape' : name.startsWith('spacing') ? 'spacing' : 'shadow',
        }));
        const { updates, creates } = legacyDraftOperations(entries, SERVER, value);
        expect(updates).toEqual([
            { tokenId: 'id-round.l', value: { kind: 'dimension', valuePx: 20, platforms: { android: 18 } } },
            {
                tokenId: 'id-down.soft.m',
                value: {
                    kind: 'shadow',
                    layers: [{ offsetX: 0, offsetY: 8, blur: 16, spread: 0, color: '#0000003D' }],
                    fallbackElevation: 5,
                    platforms: {},
                },
            },
        ]);
        expect(creates.slice(0, 2)).toEqual([
            { kind: 'radius', name: 'xxxl', valuePx: 40 },
            { kind: 'spacing', name: '14x', valuePx: 28 },
        ]);
        const created = creates[2];
        expect(created).toMatchObject({ kind: 'shadow', name: 'xl' });
        if (created.kind !== 'shadow') throw new Error('ожидалась тень');
        expect(created.variants.map((variant) => variant.variant)).toEqual([
            'down.soft',
            'down.hard',
            'up.soft',
            'up.hard',
        ]);
        expect(created.variants[1].layers[0]).toEqual({
            offsetX: 0,
            offsetY: 16,
            blur: 32,
            spread: 0,
            color: '#00000029',
        });
        // Варианты без записи черновика копируют самый крупный размер своего варианта.
        expect(created.variants[0].layers[0].blur).toBe(24);
    });
});

describe('модель темы', () => {
    const theme = () =>
        new Theme('t', '0.1.0', {
            color: [],
            gradient: [],
            shape: [
                new ShapeToken(
                    { name: 'round.l', tags: ['round', 'l'], displayName: 'round.l', enabled: true },
                    {
                        web: new WebShape('1rem'),
                        ios: new IOSShape({ kind: 'round', cornerRadius: 16 }),
                        android: new AndroidShape({ kind: 'round', cornerRadius: 16 }),
                    },
                ),
            ],
            shadow: [],
            spacing: [],
            typography: [],
            fontFamily: [],
        } as never);

    it('записывает значения из ответа изменения в формате модели', () => {
        const model = theme();
        applyToTheme(model, radius('round.l', 20), [
            { platform: 'web', value: ['1.25rem'], overridden: false },
            { platform: 'ios', value: [{ kind: 'round', cornerRadius: 20 }], overridden: false },
            { platform: 'android', value: [{ kind: 'round', cornerRadius: 18 }], overridden: true },
        ]);
        expect(model.getTokenValue('round.l', 'shape')).toEqual({
            web: '1.25rem',
            ios: { kind: 'round', cornerRadius: 20 },
            android: { kind: 'round', cornerRadius: 18 },
        });
    });

    it('добавляет созданный токен и убирает удалённый', () => {
        const model = theme();
        applyToTheme(model, shadow('down.soft.xl'));
        expect(model.getTokenValue('down.soft.xl', 'shadow', 'web')).toEqual(['0rem 0.5rem 1.5rem -0.25rem #00000014']);
        expect(model.getTokenValue('down.soft.xl', 'shadow', 'android')).toEqual([
            expect.objectContaining({ blurRadius: 24, fallbackElevation: 4 }),
        ]);
        removeFromTheme(model, [radius('round.l', 16)]);
        expect(model.getToken('round.l', 'shape')).toBeUndefined();
    });
});
