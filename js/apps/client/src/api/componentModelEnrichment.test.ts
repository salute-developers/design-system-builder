import { describe, expect, it } from 'vitest';

import type { ComponentAPI } from '../controllers/componentBuilder/type';
import {
    collectDependencies,
    enrichApi,
    templateLookup,
    variationNamesByProperty,
    webParamsByProperty,
} from './componentModelEnrichment';

const api = (id: string, name: string): ComponentAPI => ({
    id,
    name,
    type: 'dimension',
    variations: null,
    platformMappings: { xml: null, compose: null, ios: null, web: null },
});

describe('component model enrichment', () => {
    it('keeps web params in database order and ignores other platforms', () => {
        const params = webParamsByProperty([
            { id: '1', propertyId: 'p-label', platform: 'web', name: 'buttonFontFamily' },
            { id: '2', propertyId: 'p-label', platform: 'compose', name: 'labelStyle' },
            { id: '3', propertyId: 'p-label', platform: 'web', name: 'buttonFontSize' },
        ]);
        expect(params.get('p-label')).toEqual(['buttonFontFamily', 'buttonFontSize']);
    });

    it('fills web params, declared variations and the first template of the component styles', () => {
        const [height, focus] = enrichApi(
            [api('p-height', 'height'), api('p-focus', 'focusColor')],
            new Map([['p-height', ['buttonHeight']]]),
            variationNamesByProperty(
                [
                    { propertyId: 'p-height', variationId: 'v-size' },
                    { propertyId: 'p-height', variationId: 'v-foreign' },
                ],
                new Map([['v-size', 'size']]),
            ),
            templateLookup(
                {
                    componentName: 'button',
                    name: 'Button',
                    styles: { secondary: { templates: { height: { buttonHeight: '$1 1rem' } } } },
                },
                ['default', 'secondary'],
            ),
        );
        expect(height.platformMappings.web).toEqual([{ name: 'buttonHeight', adjustment: '$1 1rem' }]);
        expect(height.variations).toEqual(['size']);
        // Свойство без web-параметра остаётся без маппинга: превью его не применяет.
        expect(focus.platformMappings.web).toBeNull();
        expect(focus.variations).toBeNull();
    });

    it('passes reuse dependencies to the preview, not only compose ones', () => {
        const names = new Map([
            ['c-avatar-group', 'AvatarGroup'],
            ['c-avatar', 'Avatar'],
        ]);
        const deps = collectDependencies(
            [{ parentId: 'c-avatar-group', childId: 'c-avatar', type: 'reuse', order: 1 }],
            names,
        );
        expect(deps.get('AvatarGroup')).toEqual([
            { childId: 'c-avatar', childName: 'Avatar', type: 'reuse', order: 0 },
        ]);
    });

    it('orders both dependency types of one parent and skips links outside the design system', () => {
        const names = new Map([
            ['c-tabs', 'Tabs'],
            ['c-tab-item', 'TabItem'],
            ['c-icon-tab-item', 'IconTabItem'],
            ['c-button', 'Button'],
            ['c-avatar-group', 'AvatarGroup'],
            ['c-avatar', 'Avatar'],
        ]);
        const deps = collectDependencies(
            [
                { parentId: 'c-tabs', childId: 'c-tab-item', type: 'compose', order: 2 },
                { parentId: 'c-tabs', childId: 'c-button', type: 'reuse', order: 1 },
                // Без order — как 0, раньше всех; при равном order — по имени ребёнка.
                { parentId: 'c-tabs', childId: 'c-icon-tab-item', type: 'compose', order: null },
                { parentId: 'c-tabs', childId: 'c-avatar-group', type: 'reuse', order: 1 },
                // Связи с компонентом вне дизайн-системы пропускаются.
                { parentId: 'c-foreign', childId: 'c-avatar', type: 'reuse', order: 1 },
                { parentId: 'c-avatar-group', childId: 'c-foreign', type: 'reuse', order: 1 },
            ],
            names,
        );
        expect(deps.get('Tabs')?.map((dep) => [dep.childName, dep.type, dep.order])).toEqual([
            ['IconTabItem', 'compose', 0],
            ['AvatarGroup', 'reuse', 1],
            ['Button', 'reuse', 2],
            ['TabItem', 'compose', 3],
        ]);
        expect(deps.has('AvatarGroup')).toBe(false);
    });
});
