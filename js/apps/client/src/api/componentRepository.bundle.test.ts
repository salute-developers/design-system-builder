import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    AppearanceDto,
    ComponentConfigExportDto,
    ComponentDto,
    ComponentEditorBundleDto,
    ComponentPropertyDto,
    ComponentStyleDto,
    ComponentVariationDto,
} from './editorContracts';
import type {
    ComponentDependencyDto,
    PropertyPlatformParamDto,
    PropertyVariationDto,
    WebAdapterComponentDto,
} from './componentModelEnrichment';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('./http', () => ({ http: { get, post } }));
vi.mock('./editorReads', () => ({
    readEditor: (url: string, request: unknown, body?: unknown) =>
        body === undefined ? get(url, request) : post(url, body, request),
    invalidateEditorReads: vi.fn(),
}));
vi.mock('../utils/featureFlags', () => ({ isComponentEditorEnabled: () => true }));

import { componentRepository } from './componentRepository';

const context = { projectId: 'project-1', designSystemId: 'ds-1', tenantId: 'tenant-1' };
const root = '/api/projects/project-1/ds';

/**
 * Одна ДС-фикстура для обоих путей: Web и Compose Button с оформлениями, осями, стилями, параметрами
 * обеих платформ, связями с привязанным Icon и непривязанным компонентом, плюс чужие записи для отбора.
 */
const catalog: ComponentDto[] = [
    { id: 'c-button', name: 'Button', description: 'Кнопка', platform: 'web' },
    { id: 'c-icon', name: 'Icon', description: null, platform: 'web' },
    { id: 'c-unlinked', name: 'Spinner', description: null, platform: 'web' },
    { id: 'c-link', name: 'Link', description: null, platform: 'web' },
    { id: 'c-button-compose', name: 'Button', description: null, platform: 'compose' },
    { id: 'c-icon-compose', name: 'Icon', description: null, platform: 'compose' },
];
const links = ['c-button', 'c-icon', 'c-link', 'c-button-compose', 'c-icon-compose'].map((componentId) => ({
    id: `l-${componentId}`,
    designSystemId: 'ds-1',
    componentId,
}));
const appearances: AppearanceDto[] = [
    { id: 'a-default', designSystemId: 'ds-1', componentId: 'c-button', name: null },
    { id: 'a-secondary', designSystemId: 'ds-1', componentId: 'c-button', name: 'secondary' },
    { id: 'a-foreign', designSystemId: 'ds-2', componentId: 'c-button', name: 'secondary' },
    { id: 'a-icon', designSystemId: 'ds-1', componentId: 'c-icon', name: null },
    { id: 'a-compose', designSystemId: 'ds-1', componentId: 'c-button-compose', name: null },
];
const properties: Record<string, ComponentPropertyDto[]> = {
    'c-button': [
        { id: 'p-height', name: 'height', type: 'dimension', description: 'Высота' },
        { id: 'p-color', name: 'color', type: 'color', description: null },
        { id: 'p-icon', name: 'icon', type: 'component_style', description: null },
    ],
    'c-button-compose': [
        { id: 'pc-height', name: 'height', type: 'dimension', description: null },
        { id: 'pc-color', name: 'color', type: 'color', description: null },
    ],
};
const variations: Record<string, ComponentVariationDto[]> = {
    'c-button': [
        { id: 'v-size', name: 'size' },
        { id: 'v-view', name: 'view' },
    ],
    'c-button-compose': [{ id: 'vc-size', name: 'size' }],
};
const styles: Record<string, ComponentStyleDto[]> = {
    'c-button': [
        { id: 's-m', variationId: 'v-size', name: 'm' },
        { id: 's-l', variationId: 'v-size', name: 'l' },
        { id: 's-accent', variationId: 'v-view', name: 'accent' },
    ],
    'c-button-compose': [{ id: 'sc-m', variationId: 'vc-size', name: 'm' }],
};
const platformParams: PropertyPlatformParamDto[] = [
    { id: '1', propertyId: 'p-height', platform: 'web', name: 'buttonHeight' },
    { id: '2', propertyId: 'p-height', platform: 'web', name: 'buttonMinHeight' },
    { id: '3', propertyId: 'p-color', platform: 'web', name: 'buttonColor' },
    { id: '4', propertyId: 'p-color', platform: 'compose', name: 'contentColor' },
    { id: '5', propertyId: 'pc-height', platform: 'compose', name: 'height' },
    { id: '6', propertyId: 'pc-color', platform: 'compose', name: 'contentColor' },
    { id: '7', propertyId: 'p-other', platform: 'web', name: 'other' },
];
const propertyVariations: PropertyVariationDto[] = [
    { propertyId: 'p-height', variationId: 'v-size' },
    { propertyId: 'p-color', variationId: 'v-view' },
    { propertyId: 'p-other', variationId: 'v-other' },
];
const webAdapter: WebAdapterComponentDto[] = [
    {
        componentName: 'button',
        name: 'Button',
        styles: { default: { templates: { height: { buttonMinHeight: '$1 1rem' } } } },
    },
    { componentName: 'link', name: 'Link', styles: null },
];
const dependencies: ComponentDependencyDto[] = [
    { parentId: 'c-button', childId: 'c-icon', type: 'reuse', order: 2 },
    { parentId: 'c-button', childId: 'c-unlinked', type: 'compose', order: 1 },
    { parentId: 'c-link', childId: 'c-icon', type: 'reuse', order: null },
    { parentId: 'c-button-compose', childId: 'c-icon-compose', type: 'compose', order: 1 },
];
const property = (value: unknown) => ({ type: 'dimension', value });
const exports: Record<'web' | 'compose', ComponentConfigExportDto['components']> = {
    web: [
        {
            componentName: 'button',
            styleName: 'default',
            config: {
                invariants: { icon: { type: 'component_style', value: 'icon.default' } },
                defaults: [
                    { id: 'size', value: ['m'] },
                    { id: 'view', value: 'accent' },
                ],
                variations: [
                    {
                        id: 'size',
                        name: 'size',
                        values: [
                            { name: 'm', properties: { height: property(40) } },
                            { name: 'l', properties: { height: { ...property(48), states: [] } } },
                        ],
                    },
                    {
                        id: 'view',
                        name: 'view',
                        values: [
                            {
                                name: 'accent',
                                properties: {
                                    color: {
                                        type: 'color',
                                        value: '[general.blue.500]',
                                        states: [{ state: ['hovered'], value: 'blue.600' }],
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        },
        {
            componentName: 'button',
            styleName: 'secondary',
            config: { invariants: {}, defaults: [], variations: [] },
        },
        { componentName: 'link', styleName: 'default', config: { invariants: {}, defaults: [], variations: [] } },
    ],
    compose: [
        {
            componentName: 'button',
            styleName: 'default',
            config: {
                invariants: { color: { type: 'color', value: 'text.primary' } },
                defaults: [{ id: 'size', value: 'm' }],
                variations: [
                    { id: 'size', name: 'size', values: [{ name: 'm', properties: { height: property(40) } }] },
                ],
            },
        },
    ],
};

const listResponses: Record<string, unknown> = {
    [`${root}/design-system-components`]: links,
    [`${root}/components`]: catalog,
    [`${root}/appearances`]: appearances,
    [`${root}/property-platform-params`]: platformParams,
    [`${root}/property-variations`]: propertyVariations,
    [`${root}/component-deps`]: dependencies,
    ...Object.fromEntries(
        Object.keys(properties).flatMap((id) => [
            [`${root}/components/${id}/properties`, properties[id]],
            [`${root}/components/${id}/variations`, variations[id]],
            [`${root}/design-systems/ds-1/components/${id}/styles`, styles[id]],
        ]),
    ),
};

/** Ответ editor-bundle по правилам сервера: те же строки, ограниченные компонентом. */
const bundle = (componentId: string, platform: 'web' | 'compose'): ComponentEditorBundleDto => {
    const component = catalog.find((item) => item.id === componentId)!;
    const linked = new Set(links.map((link) => link.componentId));
    const propertyIds = new Set(properties[componentId].map((item) => item.id));
    const related = dependencies.filter((item) => item.parentId === componentId || item.childId === componentId);
    const relatedIds = new Set(related.flatMap((item) => [item.parentId, item.childId]));
    return {
        component,
        appearances: appearances.filter((item) => item.componentId === componentId && item.designSystemId === 'ds-1'),
        export: { components: exports[platform].filter((item) => item.componentName === 'button') },
        properties: properties[componentId],
        platformParams: platformParams.filter((item) => propertyIds.has(item.propertyId)),
        propertyVariations:
            platform === 'web' ? propertyVariations.filter((item) => propertyIds.has(item.propertyId)) : [],
        variations: variations[componentId],
        styles: styles[componentId],
        webAdapter: platform === 'web' ? (webAdapter.find((item) => item.name === component.name) ?? null) : null,
        dependencies: related,
        dependencyComponents: catalog.filter(
            (item) =>
                item.id !== componentId && relatedIds.has(item.id) && linked.has(item.id) && item.platform === platform,
        ),
    };
};

const bundleUrl = (componentId: string) => `${root}/design-systems/ds-1/components/${componentId}/editor-bundle`;

beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation((url: string, request: { params?: { platform?: 'web' | 'compose' } }) => {
        const match = /\/components\/([^/]+)\/editor-bundle$/.exec(url);
        if (match) return Promise.resolve({ data: bundle(match[1], request.params!.platform!) });
        if (!(url in listResponses)) throw new Error(`Unexpected GET ${url}`);
        return Promise.resolve({ data: listResponses[url] });
    });
    post.mockImplementation((url: string, body: { platform: 'web' | 'compose'; components?: string[] }) => {
        if (url.endsWith('/component-config/export'))
            return Promise.resolve({
                data: {
                    components: exports[body.platform].filter(
                        (item) => !body.components || body.components.includes(item.componentName),
                    ),
                },
            });
        if (url.endsWith('/component-config/web-adapter')) return Promise.resolve({ data: webAdapter });
        throw new Error(`Unexpected POST ${url}`);
    });
});

describe('componentRepository.loadComponentData через editor-bundle', () => {
    it.each([
        ['web', 'c-button'],
        ['compose', 'c-button-compose'],
    ] as const)('Meta %s-компонента совпадает с прежним путём', async (platform, componentId) => {
        const legacy = await componentRepository.loadComponentData(context, undefined, platform, 'Button');
        expect(get.mock.calls.some(([url]) => String(url).endsWith('/editor-bundle'))).toBe(false);
        get.mockClear();
        post.mockClear();
        const bundled = await componentRepository.loadComponentData(
            context,
            undefined,
            platform,
            'Button',
            componentId,
        );
        expect(legacy).toHaveLength(1);
        expect(legacy[0].sources.configs.length).toBeGreaterThan(0);
        expect(bundled).toEqual(legacy);
    });

    it('при выборе компонента выполняет ровно одно HTTP-чтение с платформой и версией', async () => {
        await componentRepository.loadComponentData(
            { ...context, versionId: 'version-1' },
            undefined,
            'compose',
            'Button',
            'c-button-compose',
        );
        expect(post).not.toHaveBeenCalled();
        expect(get).toHaveBeenCalledExactlyOnceWith(bundleUrl('c-button-compose'), {
            signal: undefined,
            params: { versionId: 'version-1', platform: 'compose' },
        });
    });

    it('без версии передаёт только платформу', async () => {
        const [meta] = await componentRepository.loadComponentData(context, undefined, 'web', 'Button', 'c-button');
        expect(get).toHaveBeenCalledExactlyOnceWith(bundleUrl('c-button'), {
            signal: undefined,
            params: { platform: 'web' },
        });
        expect(meta.deps).toEqual([{ childId: 'c-icon', childName: 'Icon', type: 'reuse', order: 0 }]);
    });
});
