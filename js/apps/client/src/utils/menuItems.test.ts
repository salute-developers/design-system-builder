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
