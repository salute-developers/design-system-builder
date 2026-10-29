import { describe, expect, it } from 'vitest';

import { Config } from '../controllers/componentBuilder';
import type { Meta } from '../controllers/componentBuilder/type';
import { buildMockTheme } from '../controllers/themeBuilder/themes/builders';
import { assembleComposePreviewPayload } from './assembler';
import { createComponentPreviewDraft } from './draft';

const meta = (alpha: number | undefined, stateAlpha: number | undefined): Meta => ({
    name: 'Avatar',
    description: 'Avatar',
    preview: { compose: { componentId: 'Avatar', storyId: 'Avatar' } },
    sources: {
        variations: [{ id: 'axis-size', name: 'size' }],
        api: [
            {
                id: 'background',
                name: 'background',
                type: 'color',
                variations: null,
                platformMappings: { compose: 'background', web: [], xml: null, ios: null },
            },
            {
                id: 'height',
                name: 'height',
                type: 'dimension',
                variations: ['axis-size'],
                platformMappings: { compose: 'height', web: [], xml: null, ios: null },
            },
        ],
        configs: [
            {
                id: 'Avatar',
                name: 'default',
                config: {
                    defaultVariations: [{ variationID: 'axis-size', styleID: 's' }],
                    invariantProps: [
                        {
                            id: 'background',
                            value: 'color.background',
                            ...(alpha === undefined ? {} : { alpha }),
                            states: [
                                {
                                    state: ['pressed'],
                                    value: 'color.background',
                                    ...(stateAlpha === undefined ? {} : { alpha: stateAlpha }),
                                },
                            ],
                        },
                    ],
                    variations: [
                        {
                            id: 'axis-size',
                            styles: [{ id: 's', name: 's', intersections: null, props: [{ id: 'height', value: 24 }] }],
                        },
                    ],
                },
            },
        ],
    },
});

const assemble = (alpha: number | undefined, stateAlpha: number | undefined) => {
    const theme = buildMockTheme();
    const color = theme.getTokens('color')[0];
    color.setName('light.color.background');
    color.setValue('web', '#246BCE');
    const draft = createComponentPreviewDraft({
        config: new Config(meta(alpha, stateAlpha)),
        theme,
        args: {},
        themeMode: 'light',
        themeValuePlatform: 'web',
        surface: { width: 360, height: 160, background: '#FFFFFFFF' },
    });
    if (!draft.ok) throw new Error(`draft failed: ${JSON.stringify(draft.diagnostics)}`);
    return assembleComposePreviewPayload(draft.draft);
};

describe('alpha of a property value', () => {
    it('reaches the payload for the base value and for a state value', () => {
        const result = assemble(0.2, 0.5);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.component.properties.background).toEqual({
            base: { type: 'tokenRef', tokenId: 'color.background', alpha: 0.2 },
            states: [{ when: ['pressed'], source: { type: 'tokenRef', tokenId: 'color.background', alpha: 0.5 } }],
        });
    });

    it('leaves the payload without alpha when the configuration has none', () => {
        const result = assemble(undefined, undefined);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const property = result.payload.component.properties.background;
        expect(property.base).toEqual({ type: 'tokenRef', tokenId: 'color.background' });
        expect(property.states?.[0].source).toEqual({ type: 'tokenRef', tokenId: 'color.background' });
    });

    it('rejects an alpha outside 0..1 instead of sending it to the plugin', () => {
        const result = assemble(1.5, undefined);

        expect(result.ok).toBe(false);
    });
});
