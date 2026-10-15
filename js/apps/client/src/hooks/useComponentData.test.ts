import { describe, expect, it } from 'vitest';

import { Config } from '../controllers';
import type { Meta } from '../controllers';
import { getDefaultProps } from './useComponentData';

const style = (id: string) => ({ id, name: id, intersections: null, props: [] });

const meta = (platform: 'web' | 'compose', defaults: Array<{ variationID: string; styleID: string }>): Meta => ({
    name: 'TabBar',
    description: 'TabBar',
    platform,
    sources: {
        variations: [
            { id: 'axis-size', name: 'size' },
            { id: 'axis-view', name: 'view' },
        ],
        api: [],
        configs: [
            {
                id: 'default',
                name: 'default',
                config: {
                    defaultVariations: defaults,
                    invariantProps: [],
                    variations: [
                        { id: 'axis-size', styles: [style('m'), style('l')] },
                        { id: 'axis-view', styles: [style('accent'), style('default')] },
                    ],
                },
            },
        ],
    },
});

describe('getDefaultProps', () => {
    it('selects the first style of a Compose variation that has no default', () => {
        const config = new Config(meta('compose', [{ variationID: 'axis-size', styleID: 'm' }]));

        expect(getDefaultProps(config)).toEqual({ size: 'm', view: 'accent' });
    });

    it('keeps the declared defaults of a Compose variation', () => {
        const config = new Config(
            meta('compose', [
                { variationID: 'axis-size', styleID: 'l' },
                { variationID: 'axis-view', styleID: 'default' },
            ]),
        );

        expect(getDefaultProps(config)).toEqual({ size: 'l', view: 'default' });
    });

    it('selects nothing extra for a web component that declares defaults', () => {
        const config = new Config(meta('web', [{ variationID: 'axis-size', styleID: 'm' }]));

        expect(getDefaultProps(config)).toEqual({ size: 'm' });
    });

    it('selects the first style of every variation when no defaults are declared', () => {
        const config = new Config(meta('web', []));

        expect(getDefaultProps(config)).toEqual({ size: 'm', view: 'accent' });
    });
});
