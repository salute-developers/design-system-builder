import { Config } from '../controllers/componentBuilder';
import type { Meta } from '../controllers/componentBuilder/type';
import { buildMockTheme } from '../controllers/themeBuilder/themes/builders';
import { createComponentPreviewDraft } from './draft';

export const createControllerDraftFixture = () => {
    const meta: Meta = {
        name: 'Button',
        description: 'Button',
        preview: {
            compose: {
                componentId: 'BasicButton',
                storyId: 'BasicButton',
            },
        },
        sources: {
            variations: [{ id: 'axis-density', name: 'density' }],
            api: [
                {
                    id: 'background',
                    name: 'background',
                    type: 'color',
                    variations: null,
                    platformMappings: { compose: 'backgroundColor', web: [], xml: null, ios: null },
                },
                {
                    id: 'height',
                    name: 'height',
                    type: 'dimension',
                    variations: ['axis-density'],
                    platformMappings: { compose: 'height', web: [], xml: null, ios: null },
                },
            ],
            configs: [
                {
                    id: 'BasicButton',
                    name: 'default',
                    config: {
                        defaultVariations: [{ variationID: 'axis-density', styleID: 'compact' }],
                        invariantProps: [{ id: 'background', value: 'color.background' }],
                        variations: [
                            {
                                id: 'axis-density',
                                styles: [
                                    {
                                        id: 'compact',
                                        name: 'Compact',
                                        intersections: null,
                                        props: [{ id: 'height', value: 40 }],
                                    },
                                ],
                            },
                        ],
                    },
                },
            ],
        },
    };
    const theme = buildMockTheme();
    const color = theme.getTokens('color')[0];
    color.setName('light.color.background');
    color.setValue('web', '#246BCE');

    return createComponentPreviewDraft({
        config: new Config(meta),
        theme,
        args: { density: 'compact', text: 'Controller payload', loading: false },
        themeMode: 'light',
        themeValuePlatform: 'web',
        surface: { width: 360, height: 160, background: '#FFFFFFFF' },
    });
};
