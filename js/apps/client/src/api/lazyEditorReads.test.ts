import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('./http', () => ({ http }));
vi.mock('./editorReads', () => ({
    readEditor: (url: string, request: unknown, body?: unknown) =>
        body === undefined ? http.get(url, request) : http.post(url, body, request),
    invalidateEditorReads: vi.fn(),
}));

import { loadThemeShell } from './themeEditorRepository';
import { componentRepository } from './componentRepository';
import { tokenRepository } from './tokenRepository';
import { loadJournalComponentMetadata } from './journalComponentMetadata';

const context = { projectId: 'project', designSystemId: 'system', tenantId: 'theme' };
const catalog = Array.from({ length: 100 }, (_, index) => ({ id: `c${index}`, name: `C${index}`, platform: 'web' }));
const appearances = catalog.map((component) => ({
    id: `a${component.id}`,
    componentId: component.id,
    designSystemId: 'system',
    name: 'default',
}));

const exportResponse = {
    data: {
        components: [
            {
                componentName: 'C50',
                styleName: 'default',
                config: { invariants: {}, defaults: [], variations: [] },
            },
        ],
    },
};

beforeEach(() => {
    vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'true');
    vi.stubEnv('VITE_PALETTE_SOURCE', 'api');
    Object.values(http).forEach((mock) => mock.mockReset());
    http.get.mockImplementation(async (url: string) => {
        if (url.endsWith('/projects/project')) return { data: { name: 'Project', effectiveRole: 'owner' } };
        if (url.endsWith('/design-systems/system')) return { data: { id: 'system', name: 'System' } };
        if (url.endsWith('/tenants/theme')) return { data: { id: 'theme', designSystemId: 'system', name: 'Theme' } };
        if (url.endsWith('/design-system-components'))
            return { data: catalog.map((component) => ({ designSystemId: 'system', componentId: component.id })) };
        if (url.endsWith('/components')) return { data: catalog };
        if (url.endsWith('/appearances')) return { data: appearances };
        if (url.endsWith('/properties')) return { data: [] };
        if (url.endsWith('/variations'))
            return {
                data: [
                    { id: 'axis1', name: 'size' },
                    { id: 'axis2', name: 'view' },
                ],
            };
        if (url.endsWith('/design-systems/system/components/c50/styles')) return { data: [] };
        if (url.endsWith('/design-systems/system/tokens')) return { data: [] };
        if (url.endsWith('/tenants/theme/token-values')) return { data: [] };
        if (url.endsWith('/property-platform-params')) return { data: [] };
        if (url.endsWith('/property-variations')) return { data: [] };
        if (url.endsWith('/component-deps')) return { data: [] };
        throw new Error(`Unexpected read ${url}`);
    });
    http.post.mockImplementation(async (url: string) =>
        url.endsWith('/component-config/web-adapter') ? { data: [] } : exportResponse,
    );
});
afterEach(() => vi.unstubAllEnvs());

it('группы цветов читаются с адресом выбранной версии', async () => {
    http.get.mockResolvedValueOnce({ data: [{ id: 'group' }] });
    expect(await tokenRepository.loadColorGroups({ ...context, versionId: 'version' })).toEqual([{ id: 'group' }]);
    expect(http.get).toHaveBeenCalledWith(
        '/api/projects/project/ds/design-systems/system/token-groups',
        expect.objectContaining({ params: { versionId: 'version', kind: 'color' } }),
    );
});

it('метаданные холодного журнала читаются пакетно, без конфигураций ста компонентов', async () => {
    http.get.mockImplementation(async (url: string) => ({
        data: url.endsWith('/components')
            ? catalog
            : url.endsWith('/appearances')
              ? appearances
              : url.endsWith('/properties')
                ? [{ id: 'prop', name: 'Color', componentId: 'c50' }]
                : url.endsWith('/variations')
                  ? [{ id: 'axis', name: 'Size', componentId: 'c50' }]
                  : url.endsWith('/styles')
                    ? [{ id: 'style', name: 'Large', variationId: 'axis', designSystemId: 'system' }]
                    : [],
    }));
    const metadata = await loadJournalComponentMetadata(context);
    expect(metadata.componentNames.ac50).toBe('C50');
    expect(metadata.componentNames.prop).toBe('C50');
    expect(metadata.componentNames.style).toBe('C50');
    expect(metadata.referenceNames.prop).toBe('Color');
    expect(http.get).toHaveBeenCalledTimes(5);
    expect(http.post).not.toHaveBeenCalled();
});

it('оболочка читает только метаданные, не значения, конфигурации или историю', async () => {
    const shell = await loadThemeShell(context);
    expect(shell.hasComponents).toBe(true);
    expect(shell.componentsData).toEqual([]);
    expect(http.get.mock.calls.map(([url]) => url)).toEqual(
        expect.arrayContaining([
            '/api/projects/project',
            '/api/projects/project/ds/design-systems/system',
            '/api/projects/project/ds/tenants/theme',
            '/api/projects/project/ds/design-system-components',
        ]),
    );
    expect(http.get).toHaveBeenCalledTimes(4);
    expect(http.post).not.toHaveBeenCalled();
});

it('список ста компонентов требует только каталога и кратких оформлений', async () => {
    const index = await componentRepository.loadComponentIndex(context);
    expect(index).toHaveLength(100);
    expect(index.every((item) => item.sources.configs.length === 0)).toBe(true);
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.post).not.toHaveBeenCalled();
});

it('данные C50 читаются адресно и стили всех его осей объединены одним запросом', async () => {
    const values = await componentRepository.loadComponentData(context, undefined, 'web', 'C50');
    expect(values.map((item) => item.name)).toEqual(['C50']);
    expect(http.post).toHaveBeenCalledWith(
        '/api/projects/project/ds/component-config/export',
        { designSystemId: 'system', platform: 'web', components: ['c50'] },
        expect.anything(),
    );
    const urls = http.get.mock.calls.map(([url]) => url);
    expect(urls).toContain('/api/projects/project/ds/design-systems/system/components/c50/styles');
    expect(urls.filter((url) => /\/components\/c\d+\/(properties|variations)/.test(url))).toHaveLength(2);
    expect(urls.filter((url) => /\/variations\/axis\d\/styles/.test(url))).toHaveLength(0);
    expect(http.get).toHaveBeenCalledTimes(8);
    expect(http.get.mock.calls.some(([url]) => url.endsWith('/property-platform-params'))).toBe(false);
    expect(http.post).toHaveBeenCalledTimes(2);
});

it('типографика фильтруется сервером и не запускает чтение палитры или компонентов', async () => {
    await tokenRepository.loadTokenData(context, undefined, '0.1.0', ['typography', 'fontFamily']);
    expect(http.get).toHaveBeenCalledWith(
        '/api/projects/project/ds/tenants/theme/token-values',
        expect.objectContaining({
            params: { types: 'typography,fontFamily' },
        }),
    );
    expect(http.get).toHaveBeenCalledWith(
        '/api/projects/project/ds/design-systems/system/tokens',
        expect.objectContaining({ params: { type: 'typography' } }),
    );
    expect(http.get).toHaveBeenCalledWith(
        '/api/projects/project/ds/design-systems/system/tokens',
        expect.objectContaining({ params: { type: 'fontFamily' } }),
    );
    expect(http.get).toHaveBeenCalledTimes(4);
    expect(http.post).not.toHaveBeenCalled();
});

it.each([
    ['BasicButton', 'basic-button'],
    ['TextField', 'text-field'],
    ['XMLParser', 'xml-parser'],
    ['Avatar', 'avatar'],
])(
    'адресный экспорт %s использует экспортное имя %s и возвращает непустую конфигурацию',
    async (name, exportedName) => {
        const original = http.get.getMockImplementation()!;
        http.get.mockImplementation((url, request) =>
            url.endsWith('/components')
                ? Promise.resolve({ data: catalog.map((item) => (item.id === 'c50' ? { ...item, name } : item)) })
                : original(url, request),
        );
        // Реальная ручка фильтрует именно по экспортному kebab-name, не по имени глобального каталога.
        http.post.mockImplementation(async (url, body) =>
            url.endsWith('/component-config/web-adapter')
                ? { data: [] }
                : {
                      data: {
                          components: body.components?.includes(exportedName)
                              ? [
                                    {
                                        componentName: exportedName,
                                        styleName: 'default',
                                        config: {
                                            invariants: { height: { type: 'dimension', value: 12 } },
                                            defaults: [],
                                            variations: [],
                                        },
                                    },
                                ]
                              : [],
                      },
                  },
        );
        const values = await componentRepository.loadComponentData(context, undefined, 'web', name);
        expect(values).toHaveLength(1);
        expect(values[0].name).toBe(name);
        expect(values[0].sources.configs[0].config.invariantProps).toEqual([
            expect.objectContaining({ id: 'height', value: 12 }),
        ]);
        expect(http.post.mock.calls[0][1].components).toEqual([exportedName]);
    },
);
