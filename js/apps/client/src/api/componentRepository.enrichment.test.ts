import { beforeEach, describe, expect, it, vi } from 'vitest';

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

/** Ответы ds-service: Button со свойствами height (web, шаблон) и focusColor (только compose), AvatarGroup и Avatar. */
const getResponses: Record<string, unknown> = {
    [`${root}/design-system-components`]: [
        { id: 'l-1', designSystemId: 'ds-1', componentId: 'c-button' },
        { id: 'l-2', designSystemId: 'ds-1', componentId: 'c-avatar-group' },
        { id: 'l-3', designSystemId: 'ds-1', componentId: 'c-avatar' },
    ],
    [`${root}/components`]: [
        { id: 'c-button', name: 'Button', description: null, platform: 'web' },
        { id: 'c-avatar-group', name: 'AvatarGroup', description: null, platform: 'web' },
        { id: 'c-avatar', name: 'Avatar', description: null, platform: 'web' },
    ],
    [`${root}/appearances`]: [],
    [`${root}/components/c-button/properties`]: [
        { id: 'p-height', name: 'height', type: 'dimension', description: null },
        { id: 'p-focus', name: 'focusColor', type: 'color', description: null },
    ],
    [`${root}/components/c-button/variations`]: [{ id: 'v-size', name: 'size' }],
    [`${root}/variations/v-size/styles`]: [{ id: 's-m', variationId: 'v-size', name: 'm' }],
    [`${root}/components/c-avatar-group/properties`]: [],
    [`${root}/components/c-avatar-group/variations`]: [],
    [`${root}/components/c-avatar/properties`]: [],
    [`${root}/components/c-avatar/variations`]: [],
    [`${root}/property-platform-params`]: [
        { id: '1', propertyId: 'p-height', platform: 'web', name: 'buttonHeight' },
        { id: '2', propertyId: 'p-focus', platform: 'compose', name: 'focusColor' },
    ],
    [`${root}/property-variations`]: [{ propertyId: 'p-height', variationId: 'v-size' }],
};

beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation((url: string) => {
        if (!(url in getResponses)) throw new Error(`Unexpected GET ${url}`);
        return Promise.resolve({ data: getResponses[url] });
    });
    post.mockImplementation((url: string) => {
        if (url.endsWith('/component-config/export'))
            return Promise.resolve({
                data: {
                    components: [
                        {
                            componentName: 'button',
                            styleName: 'default',
                            config: { invariants: {}, defaults: [], variations: [] },
                        },
                    ],
                },
            });
        if (url.endsWith('/component-config/web-adapter'))
            return Promise.resolve({
                data: [
                    {
                        componentName: 'button',
                        name: 'Button',
                        styles: { default: { templates: { height: { buttonHeight: '$1 1rem' } } } },
                    },
                ],
            });
        throw new Error(`Unexpected POST ${url}`);
    });
});

describe('componentRepository.loadComponentData', () => {
    it('fills web params, declared variations and templates of the web preview', async () => {
        const meta = await componentRepository.loadComponentData(context);
        const button = meta.find((item) => item.name === 'Button')!;
        const height = button.sources.api.find((item) => item.name === 'height')!;
        expect(height.platformMappings.web).toEqual([{ name: 'buttonHeight', adjustment: '$1 1rem' }]);
        expect(height.variations).toEqual(['size']);
        const focus = button.sources.api.find((item) => item.name === 'focusColor')!;
        expect(focus.platformMappings.web).toBeNull();
    });

    it('reads the published version boundary for every enrichment request', async () => {
        await componentRepository.loadComponentData({ ...context, versionId: 'version-1' });
        for (const suffix of ['/property-platform-params', '/property-variations']) {
            const call = get.mock.calls.find(([url]) => String(url).endsWith(suffix));
            expect(call?.[1]).toMatchObject({ params: { versionId: 'version-1' } });
        }
        const adapter = post.mock.calls.find(([url]) => String(url).endsWith('/component-config/web-adapter'));
        expect(adapter?.[2]).toMatchObject({ params: { versionId: 'version-1' } });
    });
});
