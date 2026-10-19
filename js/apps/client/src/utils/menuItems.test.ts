import { describe, expect, it } from 'vitest';

import { Config } from '../controllers';
import type { Meta } from '../controllers';
import { getComposeMenuItems } from './menuItems';

const config = (name: string) =>
    new Config({ name, description: name, sources: { api: [], variations: [], configs: [] } } as Meta);

describe('getComposeMenuItems', () => {
    const data = getComposeMenuItems([
        config('Avatar'),
        config('BasicButton'),
        config('CheckBox'),
        config('AiAnswer'),
        config('Unknown'),
    ]);
    const names = (group: string) =>
        data.groups[0].data.find((item) => item.name === group)?.items.map((item) => item.name);

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

    it('enables every component and keeps its config', () => {
        const items = data.groups[0].data.flatMap((group) => group.items);

        expect(items.every((item) => !item.disabled && item.data.length === 1)).toBe(true);
    });
});

describe('getComposeMenuItems with groups of the plugin', () => {
    const names = (data: ReturnType<typeof getComposeMenuItems>, group: string) =>
        data.groups[0].data.find((item) => item.name === group)?.items.map((item) => item.name);

    it('places a component into the group of the plugin instead of the client table', () => {
        const data = getComposeMenuItems(
            [config('CircularProgressBar'), config('Avatar')],
            [{ name: 'Data Display', components: ['CircularProgressBar', 'Avatar'] }],
        );

        expect(names(data, 'Data Display')).toEqual(['Avatar', 'CircularProgressBar']);
        expect(names(data, 'Overlay')).toBeUndefined();
    });

    it('falls back to the client table without groups', () => {
        const data = getComposeMenuItems([config('CircularProgressBar')]);

        expect(names(data, 'Overlay')).toEqual(['CircularProgressBar']);
    });

    it('uses the client table and Other for components missing from the groups of the plugin', () => {
        const data = getComposeMenuItems(
            [config('Avatar'), config('BasicButton'), config('Unknown')],
            [{ name: 'Data Display', components: ['Avatar'] }],
        );

        expect(names(data, 'Data Display')).toEqual(['Avatar']);
        expect(names(data, 'Data Entry')).toEqual(['BasicButton']);
        expect(names(data, 'Other')).toEqual(['Unknown']);
    });

    it('shows the group names of the plugin', () => {
        const data = getComposeMenuItems([config('AiAnswer')], [{ name: 'AI Kit', components: ['AiAnswer'] }]);

        expect(names(data, 'AI Kit')).toEqual(['AiAnswer']);
    });
});
