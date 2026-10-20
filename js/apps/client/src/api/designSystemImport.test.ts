import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, put, patch, del } = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
}));
vi.mock('./index', () => ({ http: { get, post, put, patch, delete: del }, PROJECTS_URL: '/api/projects' }));
vi.mock('./http', () => ({ http: { get, post, put, patch, delete: del } }));

import { importDesignSystemToProject } from './designSystemImport';
import type { ThemeSource } from '../controllers';

const themeData = {
    meta: {
        name: 'imported',
        tokens: [
            { type: 'color', name: 'light.surface.default.accent', displayName: 'accent', enabled: true },
            { type: 'color', name: 'dark.surface.default.accent', displayName: 'accent', enabled: true },
            { type: 'shape', name: 'round.m', displayName: 'roundM', description: 'Радиус', enabled: true },
        ],
    },
    variations: {
        color: {
            web: { 'light.surface.default.accent': '#111111', 'dark.surface.default.accent': '#222222' },
            ios: {},
            android: {},
        },
        shape: { web: { 'round.m': '8px' }, ios: {}, android: {} },
    },
} as unknown as ThemeSource;

beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    patch.mockReset();
    del.mockReset();
    post.mockImplementation((url: string, body: Record<string, unknown>) => {
        if (url.endsWith('/ds/design-systems')) return Promise.resolve({ data: { id: 'ds-new', name: body.name } });
        if (url.endsWith('/ds/tenants')) return Promise.resolve({ data: { id: 'tenant-new', editRevision: 0 } });
        if (url.endsWith('/ds/tokens')) return Promise.resolve({ data: { id: `token-${body.name}` } });
        throw new Error(`Unexpected POST ${url}`);
    });
    get.mockImplementation((url: string) => {
        if (url.endsWith('/design-systems/ds-new/tokens'))
            return Promise.resolve({
                data: [
                    { id: 'token-accent', type: 'color', name: 'surface.default.accent', enabled: true },
                    { id: 'token-text', type: 'color', name: 'text.default.primary', enabled: true },
                    { id: 'token-off', type: 'shape', name: 'round.off', enabled: false },
                ],
            });
        // Значения, которые ds-service завёл при создании темы: токена `text` в файле нет.
        if (url.endsWith('/tenants/tenant-new/token-values'))
            return Promise.resolve({
                data: [
                    {
                        id: 'tv-1',
                        tenantId: 'tenant-new',
                        tokenId: 'token-accent',
                        platform: 'web',
                        mode: 'light',
                        paletteId: null,
                        value: ['#000000'],
                        createdAt: '',
                        updatedAt: '',
                    },
                    {
                        id: 'tv-2',
                        tenantId: 'tenant-new',
                        tokenId: 'token-text',
                        platform: 'web',
                        mode: 'light',
                        paletteId: 'p-1',
                        paletteRef: '[general.gray.950]',
                        value: ['0.9'],
                        createdAt: '',
                        updatedAt: '',
                    },
                ],
            });
        throw new Error(`Unexpected GET ${url}`);
    });
    put.mockResolvedValue({ data: { editRevision: 1 } });
    patch.mockResolvedValue({ data: {} });
    del.mockResolvedValue({ data: undefined });
});

describe('importDesignSystemToProject', () => {
    it('creates the design system with a default theme, missing tokens and the values', async () => {
        const result = await importDesignSystemToProject('project-1', 'imported', themeData);
        expect(result).toEqual({ designSystemId: 'ds-new', tenantId: 'tenant-new', disabledTokens: 1 });
        expect(post).toHaveBeenCalledWith('/api/projects/project-1/ds/design-systems', {
            name: 'imported',
            projectName: 'IMPORTED',
            projectId: 'project-1',
        });
        // Версию дизайн-системы импорт не публикует: её публикует пользователь из журнала.
        expect(post.mock.calls.some(([url]) => String(url).endsWith('/ds/design-system-versions'))).toBe(false);
        expect(post).toHaveBeenCalledWith('/api/projects/project-1/ds/tenants', {
            designSystemId: 'ds-new',
            name: 'imported_default',
        });
        // Определение цвета в дизайн-системе уже есть, форма создаётся один раз без префикса режима.
        expect(post.mock.calls.filter(([url]) => url.endsWith('/ds/tokens'))).toEqual([
            [
                '/api/projects/project-1/ds/tokens',
                {
                    designSystemId: 'ds-new',
                    type: 'shape',
                    name: 'round.m',
                    displayName: 'roundM',
                    description: 'Радиус',
                    enabled: true,
                },
            ],
        ]);
        // Значения файла поверх дефолтов темы: дефолт токена, которого в файле нет, сохраняется,
        // а служебные поля прочитанных строк в пакет не попадают.
        expect(put).toHaveBeenCalledWith('/api/projects/project-1/ds/tenants/tenant-new/token-values', {
            editRevision: 0,
            values: [
                { tokenId: 'token-accent', platform: 'web', mode: 'light', paletteId: null, value: '#111111' },
                { tokenId: 'token-text', platform: 'web', mode: 'light', paletteId: 'p-1', value: ['0.9'] },
                { tokenId: 'token-accent', platform: 'web', mode: 'dark', paletteId: null, value: '#222222' },
                { tokenId: 'token-round.m', platform: 'web', mode: null, paletteId: null, value: '8px' },
            ],
        });
        // Токен набора, которого в файле нет, выключен; уже выключенный не трогается.
        expect(patch.mock.calls).toEqual([['/api/projects/project-1/ds/tokens/token-text', { enabled: false }]]);
        expect(del).not.toHaveBeenCalled();
    });

    it('retries a disable request rejected by the gateway rate limit', async () => {
        patch
            .mockRejectedValueOnce(Object.assign(new Error('503'), { isAxiosError: true, response: { status: 503 } }))
            .mockResolvedValue({ data: {} });
        const result = await importDesignSystemToProject('project-1', 'imported', themeData);
        expect(result.disabledTokens).toBe(1);
        expect(patch).toHaveBeenCalledTimes(2);
    });

    it('removes the created design system when the import fails after creation', async () => {
        put.mockRejectedValueOnce(Object.assign(new Error('422'), { isAxiosError: true, response: { status: 422 } }));
        await expect(importDesignSystemToProject('project-1', 'imported', themeData)).rejects.toThrow('422');
        expect(del).toHaveBeenCalledWith('/api/projects/project-1/ds/design-systems/ds-new');
    });
});
