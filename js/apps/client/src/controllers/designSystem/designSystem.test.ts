import { describe, expect, it } from 'vitest';

import { buttonMeta } from '../../composePreview/nestedStyleFixture';
import { Config } from '../componentBuilder';
import type { Meta } from '../componentBuilder';
import { DesignSystem } from './index';

const meta = (name: string, apiName: string, platform?: 'compose'): Meta => ({
    name,
    description: name,
    platform,
    sources: {
        api: [
            {
                id: `${platform ?? 'web'}-${apiName}`,
                name: apiName,
                type: 'dimension',
                variations: null,
                platformMappings: { compose: platform ? apiName : null, web: null, xml: null, ios: null },
            },
        ],
        variations: [],
        configs: [],
    },
});

const system = (web: Meta[], compose: Meta[]) =>
    DesignSystem.fromSnapshot({ name: 'ds', themeData: undefined, componentsData: web, composeComponentsData: compose });

describe('DesignSystem.getComponentData', () => {
    it('returns the Compose meta for a Compose config even when a web component has the same name', () => {
        const ds = system([meta('Avatar', 'webSize')], [meta('Avatar', 'composeSize', 'compose')]);
        const composeConfig = new Config(meta('Avatar', 'composeSize', 'compose'));

        expect(ds.getComponentData(composeConfig)?.sources.api[0].name).toBe('composeSize');
    });

    it('returns the web meta for a web config', () => {
        const ds = system([meta('Avatar', 'webSize')], [meta('Avatar', 'composeSize', 'compose')]);

        expect(ds.getComponentData(new Config(meta('Avatar', 'webSize')))?.sources.api[0].name).toBe('webSize');
    });

    it('finds a Compose component in a design system without web components', () => {
        const ds = system([], [{ ...buttonMeta(), platform: 'compose' }]);

        expect(ds.getComponentData(new Config({ ...buttonMeta(), platform: 'compose' }))?.name).toBe('BasicButton');
    });

    it('does not fall back to an unrelated component for a Compose config', () => {
        const ds = system([meta('Accordion', 'webGap')], []);

        expect(ds.getComponentData(new Config(meta('BasicButton', 'height', 'compose')))).toBeUndefined();
    });
});
