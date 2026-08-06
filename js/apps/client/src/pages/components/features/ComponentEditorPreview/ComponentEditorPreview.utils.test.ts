import { describe, expect, it } from 'vitest';

import { getBackgroundTokenName } from './ComponentEditorPreview.utils';

describe('getBackgroundTokenName', () => {
    it.each([
        ['backgroundPrimary', 'light.background.default.primary'],
        ['backgroundSecondary', 'light.background.default.secondary'],
        ['backgroundTertiary', 'light.background.default.tertiary'],
        ['surfaceAccent', 'light.surface.default.accent'],
    ])('maps %s to a theme token', (label, expected) => {
        expect(getBackgroundTokenName('light', label)).toBe(expected);
    });
});
