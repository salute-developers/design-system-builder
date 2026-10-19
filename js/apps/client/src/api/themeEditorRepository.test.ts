import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get, put, post, patch, remove } = vi.hoisted(() => ({
    pluginUrl: { value: undefined as string | undefined },
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
}));
vi.mock('./index', () => ({ http: { get, put, post, patch, delete: remove }, PROJECTS_URL: '/api/projects' }));
vi.mock('../composePreview', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../composePreview')>()),
    getComposePreviewPluginUrl: () => pluginUrl.value,
}));
vi.mock('./http', () => ({ http: { get, put, post, patch, delete: remove } }));
// Контракты репозиториев не зависят от реального времени сетевого планировщика;
// его интервалы, отмена, объединение и повторы проверяются отдельно в editorReads.test.ts.
vi.mock('./editorReads', () => ({
    readEditor: (url: string, request: unknown, body?: unknown) =>
        body === undefined ? get(url, request) : post(url, body, request),
    invalidateEditorReads: vi.fn(),
}));

import { loadThemeEditor } from './themeEditorRepository';
import { tokenRepository } from './tokenRepository';
import { componentRepository } from './componentRepository';
import { versionJournalRepository } from './versionJournalRepository';

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
                ['light', 'dark'].map((mode, index) => ({
                    id: `value-${platform}-${mode}`,
                    tokenId: 'token-1',
                    tenantId,
                    platform,
                    mode,
                    value: color,
                    editRevision: index + 1,
                })),
            ),
        };
    if (url.endsWith('/design-system-components')) return { data: [] };
    if (url.endsWith('/components')) return { data: [] };
    if (url.endsWith('/appearances')) return { data: [] };
    if (url.endsWith('/design-system-versions/by-design-system/ds-1'))
        return {
            data: [
                {
                    id: 'version-1',
                    designSystemId: 'ds-1',
                    sequenceNumber: 1,
                    revision: 1,
                    version: '0.1.0',
                    changelog: 'Initial',
                    publishedAt: '2026-01-01T00:00:00Z',
                },
            ],
        };
    throw new Error(`Unexpected URL ${url}`);
};

beforeEach(() => {
    pluginUrl.value = undefined;
    get.mockReset();
    put.mockReset();
    post.mockReset();
    post.mockImplementation((url: string) => {
        if (url.endsWith('/component-config/export')) return Promise.resolve({ data: { components: [] } });
        throw new Error(`Unexpected POST ${url}`);
    });
    patch.mockReset();
    remove.mockReset();
});

describe('ThemeEditorRepository with the component editor disabled', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('does not request component configs and still loads the theme', async () => {
        vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'false');
        pluginUrl.value = 'http://plugin.example/';
        get.mockImplementation((url: string) => Promise.resolve(reply('tenant-1', '#111111')(url)));

        const snapshot = await new ThemeEditorRepository().load(context);

        expect(get.mock.calls.filter(([url]) => String(url).endsWith('/component-configs'))).toHaveLength(0);
        expect(snapshot.componentsData).toEqual([]);
        expect(snapshot.composeComponentsData).toEqual([]);
        expect(snapshot.themeData.variations.color.web['light.surface.default.accent']).toBe('#111111');
    });

    it('requests component configs when the section is enabled', async () => {
        vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'true');
        get.mockImplementation((url: string) => Promise.resolve(reply('tenant-1', '#111111')(url)));

        await new ThemeEditorRepository().load(context);

        expect(get.mock.calls.filter(([url]) => String(url).endsWith('/component-configs'))).toHaveLength(1);
    });
});

describe('ThemeEditorRepository Compose components', () => {
    const configsOf = (compose: unknown[], web: unknown[] = []) => (url: string, options?: { params?: any }) =>
        url.endsWith('/component-configs')
            ? Promise.resolve({ data: options?.params?.platform === 'compose' ? compose : web })
            : Promise.resolve(reply('tenant-1', '#111111')(url));
    const config = { id: 'default', name: 'default', config: { defaultVariations: [], invariantProps: [], variations: [] } };
    const meta = (name: string, configs: unknown[] = [config]) => ({
        name,
        description: name,
        sources: { api: [], variations: [], configs },
    });

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

    it('hides Compose components that have no configuration in the design system', async () => {
        pluginUrl.value = 'http://plugin.example/';
        get.mockImplementation(configsOf([meta('Avatar'), meta('DropdownLoadingState', []), meta('Wheel', [])]));

        const snapshot = await new ThemeEditorRepository().load(context);

        expect(snapshot.composeComponentsData.map((item) => item.name)).toEqual(['Avatar']);
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

describe('Editor repositories', () => {
    it('limits parallel component detail requests below the gateway burst', async () => {
        const components = Array.from({ length: 24 }, (_, index) => ({
            id: `component-${index}`,
            name: `Component ${index}`,
            description: null,
            platform: 'web',
        }));
        let active = 0;
        let maximum = 0;
        const detail = async (data: unknown[]) => {
            active += 1;
            maximum = Math.max(maximum, active);
            await new Promise((resolve) => setTimeout(resolve, 2));
            active -= 1;
            return { data };
        };
        get.mockImplementation((url: string) => {
            if (url.endsWith('/design-system-components')) {
                return Promise.resolve({
                    data: components.map((component, index) => ({
                        id: `link-${index}`,
                        designSystemId: 'ds-1',
                        componentId: component.id,
                    })),
                });
            }
            if (url.endsWith('/components')) return Promise.resolve({ data: components });
            if (url.endsWith('/appearances')) return Promise.resolve({ data: [] });
            if (url.includes('/properties')) return detail([]);
            if (url.includes('/variations')) return detail([]);
            throw new Error(`Unexpected GET ${url}`);
        });

        const result = await componentRepository.loadComponentData(context);

        expect(result).toHaveLength(24);
        expect(maximum).toBeLessThanOrEqual(4);
    });

    it('loads component configurations only through ds-service versioned endpoints', async () => {
        get.mockImplementation((url: string) => {
            if (url.endsWith('/design-system-components'))
                return Promise.resolve({
                    data: [{ id: 'link-1', designSystemId: 'ds-1', componentId: 'component-1' }],
                });
            if (url.endsWith('/components'))
                return Promise.resolve({
                    data: [{ id: 'component-1', name: 'Button', description: 'Button', platform: 'web' }],
                });
            if (url.endsWith('/appearances'))
                return Promise.resolve({
                    data: [
                        {
                            id: 'appearance-1',
                            designSystemId: 'ds-1',
                            componentId: 'component-1',
                            name: 'default',
                        },
                    ],
                });
            if (url.endsWith('/components/component-1/properties'))
                return Promise.resolve({
                    data: [{ id: 'property-1', name: 'background', type: 'color', description: null }],
                });
            if (url.endsWith('/components/component-1/variations'))
                return Promise.resolve({ data: [{ id: 'variation-1', name: 'size' }] });
            if (url.endsWith('/variations/variation-1/styles'))
                return Promise.resolve({ data: [{ id: 'style-1', variationId: 'variation-1', name: 'm' }] });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });
        post.mockImplementation((_url: string, body: { platform: string }) =>
            Promise.resolve({
                data: {
                    components:
                        body.platform === 'web'
                            ? [
                                  {
                                      componentName: 'button',
                                      styleName: 'default',
                                      config: {
                                          invariants: { background: { type: 'color', default: '#112233' } },
                                          defaults: [{ id: 'size', value: 'm' }],
                                          variations: [{ id: 'size', name: 'size', values: [] }],
                                      },
                                  },
                              ]
                            : [],
                },
            }),
        );

        const snapshot = await loadThemeEditor(context);
        expect(snapshot.componentsData).toHaveLength(1);
        expect(snapshot.componentsData[0].sources.configs[0]).toMatchObject({
            id: 'appearance-1',
            name: 'default',
            config: {
                defaultVariations: [{ variationID: 'variation-1', styleID: 'style-1' }],
                invariantProps: [{ id: 'property-1', value: '#112233' }],
            },
        });
        expect(get.mock.calls.some(([url]) => String(url).includes('/legacy/'))).toBe(false);
    });

    it('loads only values of the selected tenant and keeps tenant snapshots independent', async () => {
        get.mockImplementation((url: string) => Promise.resolve(reply('tenant-1', '#111111')(url)));
        const first = await loadThemeEditor(context);
        get.mockImplementation((url: string) => Promise.resolve(reply('tenant-2', '#222222')(url)));
        const second = await loadThemeEditor({ ...context, tenantId: 'tenant-2' });
        expect(first.themeData.variations.color.web['light.surface.default.accent']).toBe('#111111');
        expect(second.themeData.variations.color.web['light.surface.default.accent']).toBe('#222222');
        expect(first.parameters.tenantId).toBe('tenant-1');
        expect(first.parameters.projectName).toBe('Platform');
        expect(first.parameters.packagesName).toBe('System');
        expect(first.publicationVersion).toBe('0.1.1');
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

        const snapshot = await loadThemeEditor(context);
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
                                      ? [
                                            {
                                                color: '#0000003D',
                                                offsetX: 0,
                                                offsetY: 16,
                                                spreadRadius: -8,
                                                blurRadius: 32,
                                            },
                                        ]
                                      : [
                                            {
                                                color: '#0000003D',
                                                offsetX: 0,
                                                offsetY: 16,
                                                spreadRadius: -8,
                                                blurRadius: 32,
                                            },
                                            {
                                                color: '#00000014',
                                                offsetX: 0,
                                                offsetY: 4,
                                                spreadRadius: 0,
                                                blurRadius: 8,
                                            },
                                        ],
                        })),
                    ),
                });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });

        const snapshot = await loadThemeEditor(context);
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
        await expect(loadThemeEditor(context)).rejects.toThrow('TENANT_DESIGN_SYSTEM_MISMATCH');
    });

    it('saves the active tenant with its revision through the batch endpoint', async () => {
        put.mockResolvedValue({ data: { editRevision: 4, values: [] } });
        const values = [
            {
                tokenId: 'token-1',
                platform: 'web' as const,
                mode: 'light' as const,
                value: '#111111',
                baseRevision: 2,
            },
        ];
        await expect(tokenRepository.saveTenantValues(context, 3, values)).resolves.toEqual({
            editRevision: 4,
            values: [],
            mutationMetadata: [],
        });
        expect(put).toHaveBeenCalledWith(
            '/api/projects/project-1/ds/tenants/tenant-1/token-values',
            { editRevision: 3, values },
            { headers: { 'X-DS-Base-Revision': '0' } },
        );
        expect(put.mock.calls[0][1]).not.toHaveProperty('values.0.tenantId');
    });

    it('creates a token and persists all platform values with one recoverable request', async () => {
        post.mockResolvedValue({ data: { id: 'token-created' } });
        put.mockResolvedValue({
            data: {
                editRevision: 5,
                values: [
                    {
                        id: 'value-1',
                        tokenId: 'token-created',
                        tenantId: 'tenant-1',
                        platform: 'web',
                        mode: 'light',
                        value: '#111111',
                        editRevision: 2,
                    },
                ],
            },
            headers: {
                'x-ds-mutation-metadata': JSON.stringify([
                    { entityType: 'token-value', entityId: 'value-1', revision: 2, warnings: [] },
                ]),
            },
        });
        const result = await tokenRepository.saveTokenMutation(
            context,
            undefined,
            {
                tokenName: 'light.surface.custom',
                kind: 'create',
                change: {
                    type: 'color',
                    values: { web: '#111111', ios: '#222222', android: '#333333' },
                    description: 'Custom',
                    enabled: true,
                    meta: { name: 'surface.custom', tags: [], displayName: 'Custom' },
                },
            },
            4,
            1,
            {},
            'request-key',
        );
        expect(post).toHaveBeenCalledWith(
            '/api/projects/project-1/ds/tokens',
            expect.objectContaining({ designSystemId: 'ds-1', name: 'surface.custom' }),
            { headers: { 'X-DS-Base-Revision': '1', 'Idempotency-Key': 'request-key' } },
        );
        expect(put).toHaveBeenCalledWith(
            '/api/projects/project-1/ds/tenants/tenant-1/token-values',
            expect.objectContaining({
                editRevision: 4,
                values: expect.arrayContaining([
                    expect.objectContaining({ tokenId: 'token-created', platform: 'web', mode: 'light' }),
                    expect.objectContaining({ tokenId: 'token-created', platform: 'ios', mode: 'light' }),
                    expect.objectContaining({ tokenId: 'token-created', platform: 'android', mode: 'light' }),
                ]),
            }),
            { headers: { 'X-DS-Base-Revision': '0' } },
        );
        expect(result).toEqual({
            tokenId: 'token-created',
            editRevision: 5,
            baseRevision: 1,
            valueBaseRevisions: { 'token-created:web:light': 2 },
        });
    });

    it('does not send absent platform values but preserves an explicit null', async () => {
        put.mockResolvedValue({ data: { editRevision: 5, values: [] }, headers: {} });

        await tokenRepository.saveTokenMutation(
            context,
            'token-1',
            {
                tokenName: 'surface.custom',
                kind: 'update',
                change: {
                    type: 'color',
                    values: { web: '#111111', ios: undefined, android: null },
                    enabled: true,
                },
            },
            4,
            1,
            {},
            'request-key',
        );

        const body = put.mock.calls[0][1] as { values: Array<{ platform: string; value: unknown }> };
        expect(body.values).toEqual([
            expect.objectContaining({ platform: 'web', value: '#111111' }),
            expect.objectContaining({ platform: 'android', value: null }),
        ]);
        expect(patch).not.toHaveBeenCalled();
    });

    it('patches only token definition fields explicitly selected by the editor', async () => {
        patch.mockResolvedValue({ data: {}, headers: {} });

        await tokenRepository.saveTokenMutation(
            context,
            'token-1',
            {
                tokenName: 'surface.custom',
                kind: 'update',
                definitionPatch: { description: 'Changed deliberately' },
                change: {
                    type: 'color',
                    values: { web: undefined, ios: undefined, android: undefined },
                    description: 'Changed deliberately',
                    enabled: true,
                },
            },
            4,
            8,
            {},
            'request-key',
        );

        expect(patch).toHaveBeenCalledWith(
            '/api/projects/project-1/ds/tokens/token-1',
            { description: 'Changed deliberately' },
            { headers: { 'X-DS-Base-Revision': '8' } },
        );
        expect(put).not.toHaveBeenCalled();
    });

    it('deletes a token on the server and accepts its confirmed revision', async () => {
        remove.mockResolvedValue({
            data: { ok: true },
            headers: {
                'x-ds-mutation-metadata': JSON.stringify([
                    { entityType: 'token', entityId: 'token-1', revision: 7, warnings: [] },
                ]),
            },
        });

        const result = await tokenRepository.saveTokenMutation(
            context,
            'token-1',
            {
                tokenName: 'surface.default.accent',
                kind: 'delete',
                change: {
                    type: 'color',
                    values: { web: '#111111', ios: '#111111', android: '#111111' },
                    enabled: true,
                    deleted: true,
                },
            },
            4,
            6,
            {},
            'unused-for-delete',
        );

        expect(remove).toHaveBeenCalledWith('/api/projects/project-1/ds/tokens/token-1', {
            headers: { 'X-DS-Base-Revision': '6' },
        });
        expect(result).toEqual({ tokenId: 'token-1', editRevision: 4, baseRevision: 7, valueBaseRevisions: {} });
        expect(put).not.toHaveBeenCalled();
    });

    it('autosaves a component property and default through their subject endpoints', async () => {
        get.mockImplementation((url: string) => {
            if (url.endsWith('/appearance-variations'))
                return Promise.resolve({
                    data: [
                        {
                            id: 'axis-1',
                            appearanceId: 'appearance-1',
                            variationId: 'variation-1',
                            defaultStyleId: 'style-1',
                        },
                    ],
                });
            if (url.endsWith('/appearance-variation-values')) return Promise.resolve({ data: [] });
            if (url.includes('/invariant-property-values/by-component/')) return Promise.resolve({ data: [] });
            if (url.endsWith('/variation-property-values/by-appearance/appearance-1'))
                return Promise.resolve({
                    data: [
                        {
                            id: 'value-1',
                            propertyId: 'property-1',
                            appearanceId: 'appearance-1',
                            styleId: 'style-1',
                            tokenId: null,
                            value: '40',
                            adjustment: null,
                            stateSetId: 'empty-states',
                        },
                    ],
                });
            if (url.endsWith('/states')) return Promise.resolve({ data: [] });
            if (url.endsWith('/state-sets')) return Promise.resolve({ data: [{ id: 'empty-states', stateIds: [] }] });
            if (url.endsWith('/design-systems/ds-1/tokens')) return Promise.resolve({ data: [] });
            throw new Error(`Unexpected GET ${url}`);
        });
        patch.mockImplementation((url: string) =>
            Promise.resolve({
                data: {},
                headers: {
                    'x-ds-mutation-metadata': JSON.stringify(
                        url.endsWith('/variation-property-values/value-1')
                            ? [{ entityType: 'variation-property-value', entityId: 'value-1', revision: 5 }]
                            : [{ entityType: 'appearance-variation', entityId: 'axis-1', revision: 3 }],
                    ),
                },
            }),
        );
        const before = {
            defaultVariations: [{ variationID: 'variation-1', styleID: 'style-1' }],
            invariantProps: [],
            variations: [
                {
                    id: 'variation-1',
                    styles: [
                        {
                            id: 'style-1',
                            name: 'm',
                            intersections: null,
                            props: [{ id: 'property-1', value: 40 }],
                        },
                        { id: 'style-2', name: 'l', intersections: null, props: [] },
                    ],
                },
            ],
        };
        const after = structuredClone(before);
        after.defaultVariations[0].styleID = 'style-2';
        after.variations[0].styles[0].props[0].value = 48;

        const revisions = await componentRepository.saveComponentMutation(
            context,
            {
                name: 'Button',
                description: '',
                serverBinding: { componentId: 'component-1', appearanceId: 'appearance-1' },
                sources: { api: [], variations: [], configs: [] },
            },
            { componentName: 'Button', before, after, idempotencyKeys: {} },
            { 'appearance-variation:axis-1': 2, 'variation-property-value:value-1': 4 },
        );

        expect(patch).toHaveBeenCalledWith(
            '/api/projects/project-1/ds/appearance-variations/axis-1',
            { defaultStyleId: 'style-2' },
            { headers: { 'X-DS-Base-Revision': '2' } },
        );
        expect(patch).toHaveBeenCalledWith(
            '/api/projects/project-1/ds/variation-property-values/value-1',
            { tokenId: null, value: '48', adjustment: null },
            { headers: { 'X-DS-Base-Revision': '4' } },
        );
        expect(revisions['variation-property-value:value-1']).toBe(5);
        expect(post.mock.calls.some(([url]) => String(url).includes('/component-config/import'))).toBe(false);
    });

    it('marks the existing editor read-only for a Viewer', async () => {
        get.mockImplementation((url: string) => {
            if (url.endsWith('/projects/project-1'))
                return Promise.resolve({ data: { effectiveRole: 'viewer', status: 'active' } });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });
        const snapshot = await loadThemeEditor(context);
        expect(snapshot.parameters.readOnly).toBe(true);
    });

    it('loads a color token without values of the tenant as incomplete instead of failing', async () => {
        get.mockImplementation((url: string) => {
            if (url.endsWith('/design-systems/ds-1/tokens'))
                return Promise.resolve({
                    data: [
                        ...reply('tenant-1', '#111111')(url).data,
                        {
                            id: 'token-new',
                            designSystemId: 'ds-1',
                            name: 'text.default.highlight',
                            type: 'color',
                            displayName: 'textHighlight',
                            description: null,
                            enabled: true,
                        },
                    ],
                });
            return Promise.resolve(reply('tenant-1', '#111111')(url));
        });
        const snapshot = await new ThemeEditorRepository().load(context);
        expect(snapshot.incompleteTokenIds).toEqual(['token-new']);
        expect(snapshot.parameters.effectiveRole).toBe('editor');
        const { DesignSystem } = await import('../controllers');
        const ds = DesignSystem.fromSnapshot({
            name: 'System',
            parameters: snapshot.parameters,
            themeData: snapshot.themeData,
            componentsData: snapshot.componentsData,
        });
        const built = ds.createThemeInstance({ includeExtraTokens: true });
        expect(built.getTokenValue('dark.text.default.highlight', 'color', 'web')).toBe('');
        expect(built.getTokenValue('light.surface.default.accent', 'color', 'web')).toBe('#111111');
    });

    it('passes versionId to every subject read and makes a historical snapshot read-only', async () => {
        get.mockImplementation((url: string) => Promise.resolve(reply('tenant-1', '#111111')(url)));
        const snapshot = await loadThemeEditor({ ...context, versionId: 'version-1' });
        const subjectCalls = get.mock.calls.filter(([url]) => !String(url).endsWith('/projects/project-1'));
        expect(subjectCalls.every(([, config]) => config.params.versionId === 'version-1')).toBe(true);
        expect(snapshot.parameters.readOnly).toBe(true);
    });

    it('loads the computed journal and reverts with revision and a fresh idempotency key', async () => {
        const change = {
            changeId: 'change-1',
            versionId: 'draft-1',
            entityType: 'token',
            entityId: 'token-1',
            operation: 'updated' as const,
            changedPaths: ['/name'],
            previousValue: { name: 'before' },
            currentValue: { name: 'after' },
            actorId: 'user-1',
            changedAt: '2026-01-01T00:00:00Z',
            editRevision: 4,
            parameterRevertSupported: true,
        };
        get.mockResolvedValueOnce({ data: [change] });
        post.mockResolvedValueOnce({ data: { ok: true } });

        await expect(versionJournalRepository.listChanges(context)).resolves.toEqual([change]);
        await versionJournalRepository.revertChange(context, change);
        expect(post).toHaveBeenCalledWith(
            '/api/projects/project-1/ds/design-systems/ds-1/changes/change-1/revert',
            {},
            {
                headers: {
                    'X-DS-Base-Revision': '4',
                    'Idempotency-Key': expect.any(String),
                },
            },
        );
        post.mockResolvedValueOnce({ data: { ok: true } });
        await versionJournalRepository.revertChange(context, change, ['/value/fontSize']);
        expect(post).toHaveBeenLastCalledWith(
            '/api/projects/project-1/ds/design-systems/ds-1/changes/change-1/revert',
            { paths: ['/value/fontSize'] },
            { headers: { 'X-DS-Base-Revision': '4', 'Idempotency-Key': expect.any(String) } },
        );
        const calls = post.mock.calls.length;
        await expect(
            versionJournalRepository.revertChange(context, { ...change, parameterRevertSupported: undefined }, [
                '/value/fontSize',
            ]),
        ).rejects.toThrow('Сервер не подтвердил поддержку');
        expect(post).toHaveBeenCalledTimes(calls);
    });
});
