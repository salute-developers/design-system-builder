import { describe, expect, it } from 'vitest';
import { themeFileValues } from './importThemeFile';

describe('themeFileValues', () => {
    it('maps file values for theme creation, skips placeholders and reports unknown tokens', () => {
        const { values, skipped } = themeFileValues(
            {
                meta: { name: 'brand', tokens: [] },
                variations: {
                    color: {
                        web: { 'light.text.primary': '#FFF', 'dark.text.primary': '', 'light.brand.extra': '#000' },
                        desktop: { 'light.text.primary': '#FFF' },
                    },
                    typography: { ios: { 'body.m': { fontSize: 16 } } },
                },
            },
            [
                { id: 'c1', name: 'text.primary', type: 'color' },
                { id: 't1', name: 'body.m', type: 'typography' },
            ],
        );

        expect(values).toEqual([
            { tokenId: 'c1', platform: 'web', mode: 'light', paletteId: null, value: '#FFF' },
            { tokenId: 't1', platform: 'ios', mode: null, paletteId: null, value: { fontSize: 16 } },
        ]);
        expect(skipped).toEqual(['brand.extra']);
    });
});
