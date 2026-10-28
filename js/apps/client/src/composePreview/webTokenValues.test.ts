import { describe, expect, it } from 'vitest';

import { loadWebBaseFixture } from './__fixtures__/webBaseSnapshot';
import { restorePaletteColor } from '../palette/activePalette';
import type { JsonValue } from './types';
import { normalizeWebTokenValue, parseWebColor, parseWebLength, type WebTokenType } from './webTokenValues';

const normalized = (type: WebTokenType, raw: JsonValue, id = 'token') => {
    const result = normalizeWebTokenValue(type, raw, id);
    if (!result.ok) throw new Error(result.message);
    return result;
};

describe('normalizeWebTokenValue', () => {
    it('converts rem and px sizes to px', () => {
        expect(parseWebLength('0.75rem')).toBe(12);
        expect(parseWebLength('12px')).toBe(12);
        expect(normalized('dimension', '0.125rem').value).toEqual({ type: 'dimension', value: 2 });
        expect(normalized('shape', '0.75rem').value).toEqual({ type: 'shape', cornerRadii: [12, 12, 12, 12] });
    });

    it('converts CSS colors to #RRGGBBAA', () => {
        expect(parseWebColor('#F2F8F4')).toBe('#F2F8F4FF');
        expect(parseWebColor('#17171793')).toBe('#17171793');
        expect(parseWebColor('#fff')).toBe('#FFFFFFFF');
        expect(parseWebColor('rgba(0, 0, 0, 0.5)')).toBe('#00000080');
        expect(parseWebColor('rgb(255 0 0 / 100%)')).toBe('#FF0000FF');
        expect(parseWebColor('transparent')).toBe('#00000000');
        expect(normalizeWebTokenValue('color', 'var(--x)', 'c')).toMatchObject({ ok: false });
    });

    it('splits CSS shadows into layers in px', () => {
        expect(
            normalized('shadow', [
                '0rem 0.25rem 0.875rem -0.25rem #08080814',
                '0rem 0.0625rem 0.25rem -0.0625rem #0000000A',
            ]).value,
        ).toEqual({
            type: 'shadow',
            layers: [
                { x: 0, y: 4, blur: 14, spread: -4, color: '#08080814' },
                { x: 0, y: 1, blur: 4, spread: -1, color: '#0000000A' },
            ],
        });
        expect(normalized('shadow', '0 2px 4px rgba(0, 0, 0, 0.25)').value).toEqual({
            type: 'shadow',
            layers: [{ x: 0, y: 2, blur: 4, spread: 0, color: '#00000040' }],
        });
    });

    it('parses linear gradients and solid gradient values', () => {
        expect(normalized('gradient', ['linear-gradient(45.00deg, #1A9E32FF 0%, #04C6C9FF 99.688%)']).value).toEqual({
            type: 'gradient',
            layers: [
                {
                    kind: 'linear',
                    angle: 45,
                    stops: [
                        { color: '#1A9E32FF', position: 0 },
                        { color: '#04C6C9FF', position: 0.9969 },
                    ],
                },
            ],
        });
        expect(normalized('gradient', ['#FFFFFF']).value).toEqual({
            type: 'gradient',
            layers: [
                {
                    kind: 'linear',
                    angle: 180,
                    stops: [
                        { color: '#FFFFFFFF', position: 0 },
                        { color: '#FFFFFFFF', position: 1 },
                    ],
                },
            ],
        });
        expect(normalizeWebTokenValue('gradient', ['radial-gradient(#000, #fff)'], 'g')).toMatchObject({ ok: false });
    });

    it('converts typography: rem to px, letterSpacing normal to 0 and em to px, weight and fontStyle', () => {
        expect(
            normalized('typography', {
                fontSize: '1rem',
                fontStyle: 'normal',
                fontWeight: '600',
                lineHeight: '1.25rem',
                fontFamilyRef: 'fontFamily.body',
                letterSpacing: '-0.02em',
            }).value,
        ).toEqual({
            type: 'typography',
            fontFamilyTokenId: 'fontFamily.body',
            fontSize: 16,
            lineHeight: 20,
            letterSpacing: -0.32,
            weight: 600,
            fontStyle: 'NORMAL',
        });
        expect(
            normalized('typography', {
                fontSize: '5.5rem',
                fontWeight: '300',
                lineHeight: '5.75rem',
                fontFamilyRef: 'fontFamily.display',
                letterSpacing: 'normal',
                fontStyle: 'italic',
            }).value,
        ).toMatchObject({ letterSpacing: 0, fontStyle: 'ITALIC' });
    });

    it('turns font sources into faces with WOFF2 assets', () => {
        const result = normalized(
            'fontFamily',
            {
                name: 'SB Sans Text',
                fonts: [
                    {
                        src: [
                            "url('https://cdn/Text-Bold.woff2') format('woff2')",
                            "url('https://cdn/Text-Bold.woff') format('woff')",
                        ],
                        fontStyle: 'normal',
                        fontWeight: 'bold',
                    },
                    {
                        src: ["url('https://cdn/Text-Italic.woff') format('woff')"],
                        fontStyle: 'italic',
                        fontWeight: 'normal',
                    },
                ],
            },
            'body',
        );
        expect(result.value).toEqual({
            type: 'fontFamily',
            faces: [
                { assetId: 'body:0', weight: 700, style: 'NORMAL' },
                { assetId: 'body:1', weight: 400, style: 'ITALIC' },
            ],
            allowFallback: true,
        });
        expect(result.assets).toEqual([
            { id: 'body:0', type: 'WOFF2', url: 'https://cdn/Text-Bold.woff2' },
            { id: 'body:1', type: 'WOFF', url: 'https://cdn/Text-Italic.woff' },
        ]);
    });

    it('normalizes every web value of the base theme', () => {
        const { theme } = loadWebBaseFixture();
        const failures: string[] = [];
        let count = 0;
        for (const [type, tokens] of Object.entries(theme.getTokens())) {
            const protocolType = (type === 'spacing' ? 'dimension' : type) as WebTokenType;
            for (const token of tokens) {
                const stored = token.getValue('web') as JsonValue;
                // Ссылки цветов на палитру раскрывает draft (`restorePaletteColor`), как здесь.
                const raw =
                    type === 'color' && typeof stored === 'string'
                        ? restorePaletteColor(stored, -1, token.getName())
                        : stored;
                count++;
                const result = normalizeWebTokenValue(protocolType, raw, token.getName());
                if (!result.ok) failures.push(`${token.getName()}: ${result.message}`);
            }
        }
        expect(count).toBeGreaterThan(2000);
        expect(failures).toEqual([]);
    });
});
