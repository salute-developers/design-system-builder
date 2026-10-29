import { describe, expect, it } from 'vitest';
import type { ThemeFile } from '../domain/designSystem';
import { toThemeFile } from './themeFile';

const valid = {
    meta: { name: 'brand', version: '1.0.0', tokens: [{ type: 'color', name: 'light.text.primary' }] },
    variations: { color: { web: { 'light.text.primary': '#FFFFFF' } } },
};

describe('toThemeFile', () => {
    it('accepts a file of the export format', () => {
        expect(toThemeFile(valid as unknown as ThemeFile).variations).toEqual(valid.variations);
    });

    it('accepts a file without values', () => {
        expect(toThemeFile({ meta: valid.meta } as unknown as ThemeFile).variations).toEqual({});
    });

    it.each([
        ['no meta', { variations: valid.variations }],
        ['tokens that are not a list', { ...valid, meta: { ...valid.meta, tokens: {} } }],
        ['a token without a name', { ...valid, meta: { ...valid.meta, tokens: [{ type: 'color' }] } }],
        ['a null token', { ...valid, meta: { ...valid.meta, tokens: [null] } }],
        ['variations that are a list', { ...valid, variations: [] }],
        ['a null type', { ...valid, variations: { color: null } }],
        ['a null platform', { ...valid, variations: { color: { web: null } } }],
        ['platform values that are a list', { ...valid, variations: { color: { web: ['#FFFFFF'] } } }],
    ])('rejects a file with %s', (_, source) => {
        expect(() => toThemeFile(source as unknown as ThemeFile)).toThrow('INVALID_THEME_FILE');
    });
});
