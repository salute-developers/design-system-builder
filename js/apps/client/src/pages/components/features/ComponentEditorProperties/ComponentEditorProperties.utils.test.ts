import { describe, expect, it } from 'vitest';

import { Config } from '../../../../controllers';
import type { Meta } from '../../../../controllers';
import { getPropList } from './ComponentEditorProperties.utils';

const api = (id: string, name: string, type: string, variations: string[] | null) => ({
    id,
    name,
    type,
    variations,
    platformMappings: { xml: null, compose: name, ios: null, web: null },
});

// Значение стиля вариации имеет тип, которого нет среди свойств API этой вариации.
const meta = {
    name: 'BasicButton',
    description: 'BasicButton',
    sources: {
        api: [api('shape-prop', 'shape', 'shape', ['size']), api('value-prop', 'dimension', 'dimension', [])],
        variations: [{ id: 'size', name: 'size' }],
        configs: [
            {
                id: 'config',
                config: {
                    defaultVariations: [],
                    invariantProps: [],
                    variations: [
                        {
                            id: 'size',
                            styles: [
                                {
                                    id: 'm',
                                    name: 'm',
                                    intersections: null,
                                    props: [{ id: 'value-prop', value: '8' }],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    },
} as unknown as Meta;

describe('getPropList', () => {
    it('groups a style value whose type is absent from the variation API without failing', () => {
        const config = new Config(meta);

        const groups = getPropList(config, meta.sources.api, meta.sources.variations, 'size', 'm');

        expect(groups.flatMap(({ props }) => props.map((prop) => prop.getID()))).toEqual(['value-prop']);
    });
});
