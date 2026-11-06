import type { Meta } from '../../../../controllers';

const api = (id: string, name: string, type: string, variations: string[] | null) => ({
    id,
    name,
    type,
    variations,
    platformMappings: { xml: null, compose: name, ios: null, web: null },
});

export const style = (id: string, name: string, props: { id: string; value: string }[] = []) => ({
    id,
    name,
    intersections: null,
    props,
});

// Chip: вариации в модели идут как `pilled`, `view`, `size` — инспектор ставит `size` и `view` первыми.
export const chipMeta = {
    name: 'Chip',
    description: 'Chip',
    sources: {
        api: [
            api('background', 'background', 'color', ['view']),
            api('color', 'color', 'color', ['view']),
            api('height', 'height', 'dimension', ['size']),
            api('padding', 'padding', 'dimension', ['size']),
            api('typography', 'typography', 'typography', ['size']),
            api('radius', 'radius', 'shape', ['size']),
            api('pilledRadius', 'pilledBorderRadius', 'dimension', ['pilled']),
            api('opacity', 'disabledOpacity', 'float', []),
            api('focus', 'focusColor', 'color', []),
            api('value', 'width', 'value', []),
            api('closeIcon', 'closeIcon', 'icon', []),
            api('leftIcon', 'leftIcon', 'icon', []),
        ],
        variations: [
            { id: 'pilled', name: 'pilled' },
            { id: 'view', name: 'view' },
            { id: 'size', name: 'size' },
        ],
        configs: [
            {
                id: 'config',
                config: {
                    defaultVariations: [
                        { variationID: 'size', styleID: 's-m' },
                        { variationID: 'view', styleID: 'v-default' },
                    ],
                    invariantProps: [
                        { id: 'opacity', value: '0.4' },
                        { id: 'value', value: 'auto' },
                        { id: 'closeIcon', value: 'close.16' },
                    ],
                    variations: [
                        { id: 'pilled', styles: [style('p-true', 'true', [{ id: 'pilledRadius', value: '20' }])] },
                        {
                            id: 'view',
                            styles: [
                                style('v-default', 'default', [{ id: 'background', value: 'surfaceSolidDefault' }]),
                                style('v-accent', 'accent', [{ id: 'background', value: 'surfaceAccent' }]),
                            ],
                        },
                        {
                            id: 'size',
                            styles: [
                                style('s-xs', 'xs'),
                                style('s-m', 'm', [
                                    { id: 'height', value: '40' },
                                    { id: 'padding', value: '0 14' },
                                    { id: 'typography', value: 'body.m' },
                                    { id: 'radius', value: 'round.m' },
                                ]),
                            ],
                        },
                    ],
                },
            },
        ],
    },
} as unknown as Meta;
