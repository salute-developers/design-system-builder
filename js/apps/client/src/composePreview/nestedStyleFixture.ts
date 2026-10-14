import type { Meta } from '../controllers';

const api = (id: string, name: string, type: string, variations: string[] | null) =>
    ({
        id,
        name,
        type,
        variations,
        platformMappings: { xml: null, compose: name, ios: null, web: null },
    }) as Meta['sources']['api'][number];

/** Компонент с группой кнопок: значения в стилях, в сочетании стилей и ссылка на стиль другого компонента. */
export const buttonMeta = (): Meta => ({
    name: 'BasicButton',
    description: 'BasicButton',
    sources: {
        api: [api('height', 'height', 'dimension', ['size'])],
        variations: [
            { id: 'size', name: 'size' },
            { id: 'view', name: 'view' },
        ],
        configs: [
            {
                id: 'button-config',
                name: 'basic-button',
                config: {
                    defaultVariations: [
                        { variationID: 'size', styleID: 'size-xxs' },
                        { variationID: 'view', styleID: 'view-default' },
                    ],
                    invariantProps: [],
                    variations: [
                        {
                            id: 'size',
                            styles: [
                                {
                                    id: 'size-xxs',
                                    name: 'xxs',
                                    intersections: null,
                                    props: [{ id: 'height', value: '24' }],
                                },
                            ],
                        },
                        { id: 'view', styles: [{ id: 'view-default', name: 'default', intersections: null, props: [] }] },
                    ],
                },
            },
        ],
    },
});

export const groupMeta = (): Meta => ({
    name: 'ButtonGroup',
    description: 'ButtonGroup',
    sources: {
        api: [
            api('buttonStyle', 'buttonStyle', 'component_style', ['size']),
            api('spacing', 'spacing', 'dimension', null),
            api('shape', 'externalShape', 'dimension', ['shape']),
        ],
        variations: [
            { id: 'size', name: 'size' },
            { id: 'gap', name: 'gap' },
            { id: 'shape', name: 'shape' },
        ],
        configs: [
            {
                id: 'group-config',
                name: 'basic-button-group',
                config: {
                    defaultVariations: [],
                    invariantProps: [],
                    variations: [
                        {
                            id: 'size',
                            styles: [
                                {
                                    id: 'group-xxs',
                                    name: 'xxs',
                                    intersections: null,
                                    props: [{ id: 'buttonStyle', value: 'basic-button.xxs.default' }],
                                },
                            ],
                        },
                        {
                            id: 'gap',
                            styles: [
                                { id: 'gap-wide', name: 'wide', intersections: null, props: [] },
                                { id: 'gap-dense', name: 'dense', intersections: null, props: [] },
                            ],
                        },
                        {
                            id: 'shape',
                            styles: [{ id: 'shape-default', name: 'default', intersections: null, props: [] }],
                        },
                    ],
                    combinations: [
                        { styleIDs: ['group-xxs', 'gap-wide'], props: [{ id: 'spacing', value: '8' }] },
                        { styleIDs: ['group-xxs', 'gap-dense'], props: [{ id: 'spacing', value: '2' }] },
                        { styleIDs: ['group-xxs', 'shape-default'], props: [{ id: 'shape', value: '12' }] },
                    ],
                },
            },
        ],
    },
});
