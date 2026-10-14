import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, put, pluginUrl } = vi.hoisted(() => ({
    get: vi.fn(),
    put: vi.fn(),
    pluginUrl: { value: undefined as string | undefined },
}));
vi.mock('./index', () => ({ http: { get, put }, PROJECTS_URL: '/api/projects' }));
vi.mock('../composePreview', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../composePreview')>()),
    getComposePreviewPluginUrl: () => pluginUrl.value,
}));

import { ThemeEditorRepository } from './themeEditorRepository';
import { AndroidGradient, GradientToken, IOSGradient, Theme, WebGradient } from '../controllers';
import { getMenuItems } from '../utils';
import { getTokenValue } from '../pages/shapes/features/TokenShapeEditor/TokenShapeEditor.utils';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };
const reply = (tenantId: string, color: string) => (url: string) => {
    if (url.endsWith('/projects/project-1')) return { data: { name: 'Platform', effectiveRole: 'editor' } };
    if (url.endsWith('/design-systems/ds-1')) return { data: { id: 'ds-1', name: 'System' } };
    if (url.endsWith(`/tenants/${tenantId}`))
        return { data: { id: tenantId, designSystemId: 'ds-1', name: tenantId, editRevision: 3 } };
    if (url.endsWith('/design-systems/ds-1/tokens'))
        return {
            data: [
                {
                    id: 'token-1',
                    designSystemId: 'ds-1',
                    name: 'surface.default.accent',
                    type: 'color',
                    displayName: null,
                    description: null,
                    enabled: true,
                },
            ],
        };
    if (url.endsWith(`/tenants/${tenantId}/token-values`))
        return {
            data: ['web', 'ios', 'android'].flatMap((platform) =>
                ['light', 'dark'].map((mode) => ({ tokenId: 'token-1', tenantId, platform, mode, value: color })),
            ),
        };
    if (url.endsWith('/component-configs')) return { data: [] };
    throw new Error(`Unexpected URL ${url}`);
};

beforeEach(() => {
    pluginUrl.value = undefined;
    get.mockReset();
    put.mockReset();
});

describe('ThemeEditorRepository Compose components', () => {
    const configsOf = (compose: unknown[], web: unknown[] = []) => (url: string, options?: { params?: any }) =>
        url.endsWith('/component-configs')
            ? Promise.resolve({ data: options?.params?.platform === 'compose' ? compose : web })
            : Promise.resolve(reply('tenant-1', '#111111')(url));
    const meta = (name: string) => ({ name, description: name, sources: { api: [], variations: [], configs: [] } });

    it('does not request Compose components without a plugin URL', async () => {
        get.mockImplementation(configsOf([meta('BasicButton')]));

        const snapshot = await new ThemeEditorRepository().load(context);

        expect(snapshot.composeComponentsData).toEqual([]);
        expect(get.mock.calls.filter(([, options]) => options?.params?.platform === 'compose')).toHaveLength(0);
    });

    it('loads Compose components separately and binds them to the plugin by name', async () => {
        pluginUrl.value = 'http://plugin.example/';
        get.mockImplementation(configsOf([meta('Avatar')], [meta('Avatar')]));

        const snapshot = await new ThemeEditorRepository().load(context);

        expect(snapshot.componentsData.map((item) => item.platform)).toEqual([undefined]);
        expect(snapshot.composeComponentsData).toEqual([
            expect.objectContaining({
                name: 'Avatar',
                platform: 'compose',
                preview: { compose: { componentId: 'Avatar', storyId: 'Avatar' } },
            }),
        ]);
    });

    it('keeps the editor usable when Compose components fail to load', async () => {
        pluginUrl.value = 'http://plugin.example/';
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        get.mockImplementation((url: string, options?: { params?: any }) =>
            options?.params?.platform === 'compose'
                ? Promise.reject(new Error('HTTP 500'))
                : Promise.resolve(reply('tenant-1', '#111111')(url)),
        );

        const snapshot = await new ThemeEditorRepository().load(context);

        expect(snapshot.composeComponentsData).toEqual([]);
        error.mockRestore();
    });
});

describe('ThemeEditorRepository', () => {
    it('keeps the opacity of palette references stored through paletteId', async () => {
        const repository = new ThemeEditorRepository();
        get.mockImplementation((url: string) => {
            if (url.endsWith('/tenants/tenant-1/token-values'))
                return Promise.resolve({
                    data: [
                        { tokenId: 'token-1', tenantId: 'tenant-1', platform: 'web', mode: 'dark', paletteId: 'p1', value: ['0.56'] },
                        { tokenId: 'token-1', tenantId: 'tenant-1', platform: 'web', mode: 'light', paletteId: 'p1', value: null },
                    ],
                });
            if (url.endsWith('/ds/palette'))
                return Promise.resolve({ data: [{ id: 'p1', type: 'general', shade: 'amber', saturation: 300 }] });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });
        const snapshot = await repository.load(context);
        expect(snapshot.themeData.variations.color.web['dark.surface.default.accent']).toBe('[general.amber.300][0.56]');
        expect(snapshot.themeData.variations.color.web['light.surface.default.accent']).toBe('[general.amber.300]');
    });

    it('edits the palette reference of a color resolved by the theme palette', async () => {
        const repository = new ThemeEditorRepository();
        get.mockImplementation((url: string) => {
            if (url.endsWith('/tenants/tenant-1/token-values'))
                return Promise.resolve({
                    data: [
                        {
                            tokenId: 'token-1',
                            tenantId: 'tenant-1',
                            platform: 'web',
                            mode: 'dark',
                            paletteId: null,
                            paletteRef: '[general.green.500][0.8]',
                            value: ['#1F8A70CC'],
                        },
                        { tokenId: 'token-1', tenantId: 'tenant-1', platform: 'web', mode: 'light', value: ['#FFFFFF'] },
                    ],
                });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });
        const snapshot = await repository.load(context);
        expect(snapshot.themeData.variations.color.web['dark.surface.default.accent']).toBe('[general.green.500][0.8]');
        expect(snapshot.themeData.variations.color.web['light.surface.default.accent']).toBe('#FFFFFF');
        expect(get).not.toHaveBeenCalledWith(expect.stringMatching(/\/ds\/palette$/), expect.anything());
    });

    it('loads only values of the selected tenant and keeps tenant snapshots independent', async () => {
        const repository = new ThemeEditorRepository();
        get.mockImplementation((url: string) => Promise.resolve(reply('tenant-1', '#111111')(url)));
        const first = await repository.load(context);
        get.mockImplementation((url: string) => Promise.resolve(reply('tenant-2', '#222222')(url)));
        const second = await repository.load({ ...context, tenantId: 'tenant-2' });
        expect(first.themeData.variations.color.web['light.surface.default.accent']).toBe('#111111');
        expect(second.themeData.variations.color.web['light.surface.default.accent']).toBe('#222222');
        expect(first.parameters.tenantId).toBe('tenant-1');
        expect(first.parameters.projectName).toBe('Platform');
        expect(first.parameters.packagesName).toBe('System');
        expect(second.parameters.tenantId).toBe('tenant-2');
    });

    it('keeps an untouched Theme gradient array-shaped when opening the colors editor', async () => {
        get.mockImplementation((url: string) => {
            if (url.endsWith('/design-systems/ds-1/tokens'))
                return Promise.resolve({
                    data: [
                        {
                            id: 'gradient-1',
                            designSystemId: 'ds-1',
                            name: 'surface.default.gradient',
                            type: 'gradient',
                            displayName: 'Gradient',
                            description: null,
                            enabled: true,
                        },
                    ],
                });
            if (url.endsWith('/tenants/tenant-1/token-values'))
                return Promise.resolve({
                    data: ['web', 'ios', 'android'].map((platform) => ({
                        tokenId: 'gradient-1',
                        tenantId: 'tenant-1',
                        platform,
                        mode: null,
                        value: ['linear-gradient(90deg, #000 0%, #fff 100%)'],
                    })),
                });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });

        const snapshot = await new ThemeEditorRepository().load(context);
        const gradient = new GradientToken(snapshot.themeData.meta.tokens[0], {
            web: new WebGradient(snapshot.themeData.variations.gradient.web['surface.default.gradient']),
            ios: new IOSGradient(snapshot.themeData.variations.gradient.ios['surface.default.gradient']),
            android: new AndroidGradient(snapshot.themeData.variations.gradient.android['surface.default.gradient']),
        });
        const theme = new Theme('Untouched', '0.1.0', {
            color: [],
            gradient: [gradient],
            shadow: [],
            shape: [],
            spacing: [],
            typography: [],
            fontFamily: [],
        });

        expect(snapshot.themeData.variations.gradient.web['surface.default.gradient']).toEqual([
            'linear-gradient(90deg, #000 0%, #fff 100%)',
        ]);
        expect(() => getMenuItems(theme, 'color')).not.toThrow();
    });

    it('keeps single-layer and multi-layer shadows array-shaped for the shadow editor', async () => {
        get.mockImplementation((url: string) => {
            if (url.endsWith('/design-systems/ds-1/tokens'))
                return Promise.resolve({
                    data: ['single', 'multi'].map((name) => ({
                        id: `shadow-${name}`,
                        designSystemId: 'ds-1',
                        name: `down.soft.${name}`,
                        type: 'shadow',
                        displayName: name,
                        description: null,
                        enabled: true,
                    })),
                });
            if (url.endsWith('/tenants/tenant-1/token-values'))
                return Promise.resolve({
                    data: ['single', 'multi'].flatMap((name) =>
                        ['web', 'ios', 'android'].map((platform) => ({
                            tokenId: `shadow-${name}`,
                            tenantId: 'tenant-1',
                            platform,
                            mode: null,
                            value:
                                platform === 'web'
                                    ? name === 'single'
                                        ? ['0rem 1rem 2rem -0.5rem #0000003D']
                                        : ['0rem 1rem 2rem -0.5rem #0000003D', '0rem 0.25rem 0.5rem #00000014']
                                    : name === 'single'
                                      ? [{ color: '#0000003D', offsetX: 0, offsetY: 16, spreadRadius: -8, blurRadius: 32 }]
                                      : [
                                            { color: '#0000003D', offsetX: 0, offsetY: 16, spreadRadius: -8, blurRadius: 32 },
                                            { color: '#00000014', offsetX: 0, offsetY: 4, spreadRadius: 0, blurRadius: 8 },
                                        ],
                        })),
                    ),
                });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });

        const snapshot = await new ThemeEditorRepository().load(context);
        const single = snapshot.themeData.variations.shadow.web['down.soft.single'];
        const multi = snapshot.themeData.variations.shadow.web['down.soft.multi'];

        expect(single).toEqual(['0rem 1rem 2rem -0.5rem #0000003D']);
        expect(multi).toHaveLength(2);
        expect(getTokenValue(single)).toEqual([
            expect.objectContaining({ offsetY: '16', blur: '32', spread: '-8', color: '#000000' }),
        ]);
    });

    it('rejects a tenant from another design system instead of selecting a fallback', async () => {
        get.mockImplementation((url: string) => {
            if (url.endsWith('/tenants/tenant-1'))
                return Promise.resolve({
                    data: { id: 'tenant-1', designSystemId: 'other', name: 'Wrong', editRevision: 0 },
                });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });
        await expect(new ThemeEditorRepository().load(context)).rejects.toThrow('TENANT_DESIGN_SYSTEM_MISMATCH');
    });

    it('saves the active tenant with its revision through the batch endpoint', async () => {
        put.mockResolvedValue({ data: { editRevision: 4 } });
        const values = [
            {
                tokenId: 'token-1',
                tenantId: 'tenant-1',
                platform: 'web' as const,
                mode: 'light' as const,
                value: '#111111',
            },
        ];
        await expect(new ThemeEditorRepository().saveTenantValues(context, 3, values)).resolves.toEqual({
            editRevision: 4,
        });
        expect(put).toHaveBeenCalledWith('/api/projects/project-1/ds/tenants/tenant-1/token-values', {
            editRevision: 3,
            values,
        });
    });

    it('marks the existing editor read-only for a Viewer', async () => {
        get.mockImplementation((url: string) => {
            if (url.endsWith('/projects/project-1'))
                return Promise.resolve({ data: { effectiveRole: 'viewer', status: 'active' } });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });
        const snapshot = await new ThemeEditorRepository().load(context);
        expect(snapshot.parameters.readOnly).toBe(true);
    });
});
