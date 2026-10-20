import { describe, expect, it } from 'vitest';

import type { ComponentAPI } from '../controllers/componentBuilder/type';
import { enrichApi, templateLookup, variationNamesByProperty, webParamsByProperty } from './componentModelEnrichment';

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
});
