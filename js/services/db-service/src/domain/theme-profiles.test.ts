import { describe, expect, it } from 'vitest';
import { fallbackPreview, initialTokenValue, profilePreview, type ThemeColorConfig } from './theme-profiles';

describe('theme profiles', () => {
    it.each([
        ['sber', '#108E26', '#1A9E32'],
        ['malachite', '#107F8C', '#19B9A5'],
        ['b2b', '#1B1D22', '#F8FAFC'],
    ] as const)('provides %s light and dark accents', (profile, light, dark) => {
        expect(profilePreview({ profile })).toMatchObject({ accentLight: light, accentDark: dark });
    });

    it('normalizes a custom palette into preview and token values', () => {
        const config: ThemeColorConfig = {
            profile: 'custom',
            customPalette: { primary: '#6d5dfc', onPrimary: '#ffffff', background: '#f7f6ff', text: '#19162d' },
        };
        expect(profilePreview(config)).toMatchObject({ accentLight: '#6D5DFC', onAccentLight: '#FFFFFF' });
        expect(initialTokenValue({ name: 'text.default.accent', type: 'color' }, 'light', config)).toBe('#6D5DFC');
    });

    it('returns a stable contrasting fallback for a legacy tenant', () => {
        expect(fallbackPreview('tenant-a')).toEqual(fallbackPreview('tenant-a'));
        expect(fallbackPreview('tenant-a')).not.toEqual(fallbackPreview('tenant-b'));
    });
});
