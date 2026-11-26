import { describe, expect, it } from 'vitest';

import { byThemeName } from './themeProfiles';

describe('byThemeName', () => {
    it('сравнивает числа в названиях как числа, без учёта регистра', () => {
        const names = ['Theme10', 'theme2', 'Theme1', 'Тёмная', 'Theme11', 'Theme9', 'Светлая'];
        expect(
            names
                .map((name) => ({ name }))
                .sort(byThemeName)
                .map(({ name }) => name),
        ).toEqual(['Theme1', 'theme2', 'Theme9', 'Theme10', 'Theme11', 'Светлая', 'Тёмная']);
    });
});
