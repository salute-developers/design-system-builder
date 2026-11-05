import { describe, expect, it } from 'vitest';

import { Config } from '../controllers';
import type { Meta } from '../controllers';
import { getComponentGroups } from './menuItems';

const config = (name: string, platform: Meta['platform'] = 'compose') =>
    new Config({ name, description: name, platform, sources: { api: [], variations: [], configs: [] } } as Meta);

describe('getComponentGroups', () => {
    const data = getComponentGroups([
        config('Avatar'),
        config('BasicButton'),
        config('CheckBox'),
        config('AiAnswer'),
        config('Unknown'),
    ]);
    const names = (group: string) => data.find((item) => item.name === group)?.items.map((item) => item.getName());

    it('places Compose components into the same groups as web components', () => {
        expect(names('Data Display')).toEqual(['Avatar']);
    });

    it('groups Compose components whose names differ from web', () => {
        expect(names('Data Entry')).toEqual(['BasicButton', 'CheckBox']);
        expect(names('AI')).toEqual(['AiAnswer']);
    });

    it('collects components without a known group into a separate group', () => {
        expect(names('Other')).toEqual(['Unknown']);
    });

    it('keeps the group of unknown components last', () => {
        expect(data.at(-1)?.name).toBe('Other');
    });

    it('hides web components the editor does not support', () => {
        expect(getComponentGroups([config('Flow', 'web')])).toEqual([]);
    });

    it('keeps Compose components whose web namesakes are unsupported', () => {
        const groups = getComponentGroups([config('Overlay'), config('Carousel')]);

        expect(groups.flatMap(({ items }) => items.map((item) => item.getName()))).toEqual(['Carousel', 'Overlay']);
    });
});

describe('getComponentGroups with groups of the plugin', () => {
    const names = (data: ReturnType<typeof getComponentGroups>, group: string) =>
        data.find((item) => item.name === group)?.items.map((item) => item.getName());

    it('places a component into the group of the plugin instead of the client table', () => {
        const data = getComponentGroups(
            [config('CircularProgressBar'), config('Avatar')],
            [{ name: 'Data Display', components: ['CircularProgressBar', 'Avatar'] }],
        );

        expect(names(data, 'Data Display')).toEqual(['Avatar', 'CircularProgressBar']);
        expect(names(data, 'Overlay')).toBeUndefined();
    });

    it('falls back to the client table without groups', () => {
        const data = getComponentGroups([config('CircularProgressBar')]);

        expect(names(data, 'Overlay')).toEqual(['CircularProgressBar']);
    });

    it('uses the client table and Other for components missing from the groups of the plugin', () => {
        const data = getComponentGroups(
            [config('Avatar'), config('BasicButton'), config('Unknown')],
            [{ name: 'Data Display', components: ['Avatar'] }],
        );

        expect(names(data, 'Data Display')).toEqual(['Avatar']);
        expect(names(data, 'Data Entry')).toEqual(['BasicButton']);
        expect(names(data, 'Other')).toEqual(['Unknown']);
    });

    it('shows the group names of the plugin', () => {
        const data = getComponentGroups([config('AiAnswer')], [{ name: 'AI Kit', components: ['AiAnswer'] }]);

        expect(names(data, 'AI Kit')).toEqual(['AiAnswer']);
    });
});
