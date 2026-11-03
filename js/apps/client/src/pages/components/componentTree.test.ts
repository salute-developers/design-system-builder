import { describe, expect, it } from 'vitest';

import type { Config } from '../../controllers';
import { buildComponentTree, emptyTreeMessage, entryPlatform } from './componentTree';

const config = (name: string, platform: string) => ({ getName: () => name, getPlatform: () => platform }) as Config;

const groups = {
    web: [
        { name: 'Data Display', items: [config('Avatar', 'web'), config('Badge', 'web')] },
        { name: 'Other', items: [config('Web', 'web')] },
    ],
    compose: [
        { name: 'AI', items: [config('AiAnswer', 'compose')] },
        { name: 'Data Display', items: [config('Avatar', 'compose')] },
    ],
};

describe('buildComponentTree', () => {
    it('merges platforms by name on the all filter and keeps Other last', () => {
        const tree = buildComponentTree(groups, 'all', '');

        expect(tree.map(({ name }) => name)).toEqual(['AI', 'Data Display', 'Other']);
        expect(tree[1].items.map(({ name, configs }) => [name, configs.length])).toEqual([
            ['Avatar', 2],
            ['Badge', 1],
        ]);
    });

    it('shows only the selected platform', () => {
        const tree = buildComponentTree(groups, 'compose', '');

        expect(tree.flatMap(({ items }) => items.map(({ name }) => name))).toEqual(['AiAnswer', 'Avatar']);
    });

    it('has no rows for platforms without an editor', () => {
        expect(buildComponentTree(groups, 'ios', '')).toEqual([]);
    });

    it('searches by a case-insensitive substring and drops empty groups', () => {
        const tree = buildComponentTree(groups, 'all', ' BAD ');

        expect(tree.map(({ name }) => name)).toEqual(['Data Display']);
        expect(tree[0].items.map(({ name }) => name)).toEqual(['Badge']);
    });
});

describe('entryPlatform', () => {
    const [{ items }] = buildComponentTree(groups, 'all', 'avatar');

    it('opens Web first on the all filter', () => {
        expect(entryPlatform(items[0], 'all')).toBe('web');
    });

    it('opens the selected platform', () => {
        expect(entryPlatform(items[0], 'compose')).toBe('compose');
    });
});

describe('emptyTreeMessage', () => {
    it('explains why the list is empty', () => {
        expect(emptyTreeMessage(0, 0, 'all', '')).toContain('скрыты');
        expect(emptyTreeMessage(3, 0, 'ios', '')).toContain('Для выбранной платформы');
        expect(emptyTreeMessage(3, 3, 'all', 'x')).toContain('«x»');
    });
});
