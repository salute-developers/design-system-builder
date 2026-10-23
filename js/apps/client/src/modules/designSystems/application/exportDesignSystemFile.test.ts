import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemePalette } from '../../palette';

const { loadTokenData, listThemes, downloadThemeFile } = vi.hoisted(() => ({
    loadTokenData: vi.fn(),
    listThemes: vi.fn(),
    downloadThemeFile: vi.fn(),
}));
vi.mock('../../../api/tokenRepository', () => ({ tokenRepository: { loadTokenData } }));
vi.mock('../../themes/data/themesApi', () => ({ themesApi: { list: listThemes } }));
vi.mock('./themeFile', () => ({ downloadThemeFile }));

import { exportDesignSystemFile } from './exportDesignSystemFile';

/** Палитра темы, в которой ступень `general.blue.500` изменена относительно шаблона. */
const palette = {
    tenantId: 'tenant-1',
    editRevision: 1,
    canEdit: true,
    offBrand: false,
    groups: [
        {
            id: 'neutral',
            systemKey: 'neutral',
            ramps: [{ slot: { type: 'general', shade: 'blue' }, steps: [{ step: 500, value: '#123456' }] }],
        },
    ],
    tokens: [],
    template: [{ type: 'general', shade: 'blue', steps: [{ step: 500, value: '#0000FF' }] }],
} as unknown as ThemePalette;

const themeData = {
    meta: { name: 'base_default', tokens: [] },
    variations: {
        color: {
            web: {
                'light.text.default.primary': '[general.blue.500]',
                'dark.text.default.primary': '[general.blue.500][0.5]',
                'light.text.default.secondary': '#ABCDEF',
            },
        },
        spacing: { web: { 'spacing.m': '[general.blue.500]' } },
    },
};

beforeEach(() => {
    vi.clearAllMocks();
    listThemes.mockResolvedValue([{ id: 'tenant-1', name: 'base_default' }]);
});

describe('exportDesignSystemFile', () => {
    it('saves colors linked to the palette as the color of the source theme', async () => {
        loadTokenData.mockResolvedValue({ themeData, palette });
        await exportDesignSystemFile('project-1', { id: 'ds-1', name: 'base' });
        const [name, file] = downloadThemeFile.mock.calls[0];
        expect(name).toBe('base');
        expect(file.meta.name).toBe('base');
        expect(file.variations.color.web).toEqual({
            'light.text.default.primary': '#123456',
            'dark.text.default.primary': '#12345680',
            'light.text.default.secondary': '#ABCDEF',
        });
        expect(file.variations.spacing).toEqual(themeData.variations.spacing);
    });

    it('does not save a file when the palette of the theme failed to load', async () => {
        loadTokenData.mockResolvedValue({ themeData, palette: undefined, paletteError: new Error('PALETTE') });
        await expect(exportDesignSystemFile('project-1', { id: 'ds-1', name: 'base' })).rejects.toThrow('PALETTE');
        expect(downloadThemeFile).not.toHaveBeenCalled();
    });
});
