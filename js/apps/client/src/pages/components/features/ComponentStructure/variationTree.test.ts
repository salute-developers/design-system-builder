import { describe, expect, it } from 'vitest';

import type { EditorAxisDto } from '../../../../api/editorContracts';

import {
    branchPathLabel,
    configuredWithin,
    isConfigured,
    isTreePath,
    offTreeCombinations,
    treeAxes,
    treeChildren,
} from './variationTree';

const axis = (name: string, position: number, values: string[], isColorScheme = false): EditorAxisDto => ({
    id: `axis-${name}`,
    variationId: name,
    name,
    displayName: null,
    position,
    isColorScheme,
    locked: isColorScheme,
    defaultStyleId: null,
    revision: 1,
    values: values.map((value, index) => ({
        id: `value-${value}`,
        styleId: `${name}-${value}`,
        name: value,
        displayName: null,
        position: index,
        revision: 1,
    })),
});

const axes = treeAxes([
    axis('view', 0, ['default', 'accent'], true),
    axis('size', 1, ['m', 'l']),
    axis('shape', 2, ['pilled']),
]);

describe('variationTree', () => {
    it('ставит цветовую схему последней', () => {
        expect(axes.map((item) => item.name)).toEqual(['size', 'shape', 'view']);
    });

    it('строит уровни подряд: цветовая схема только в листьях', () => {
        const review = treeAxes([
            axis('size', 0, ['l']),
            axis('shape', 1, ['default', 'pilled']),
            axis('view', 2, ['default'], true),
        ]);
        const roots = treeChildren(review);
        expect(roots.map((branch) => branch.styleIds)).toEqual([['size-l']]);
        const shapes = treeChildren(review, roots[0]);
        expect(shapes.map((branch) => branch.styleIds)).toEqual([
            ['size-l', 'shape-default'],
            ['size-l', 'shape-pilled'],
        ]);
        expect(shapes.map((branch) => treeChildren(review, branch).map((leaf) => leaf.value.name))).toEqual([
            ['default'],
            ['default'],
        ]);
        const leaf = treeChildren(review, shapes[0])[0];
        expect(treeChildren(review, leaf)).toEqual([]);
    });

    it('находит настроенные пути в ветке и под ней', () => {
        const configured = [['size-l', 'shape-pilled']];
        const [m, l] = treeChildren(axes);

        expect(configuredWithin(axes, l, configured)).toEqual(configured);
        expect(configuredWithin(axes, m, configured)).toEqual([]);

        const lPilled = treeChildren(axes, l).find((branch) => branch.value.name === 'pilled')!;
        expect(configuredWithin(axes, lPilled, configured)).toEqual(configured);
        expect(isConfigured(lPilled.styleIds, configured)).toBe(true);
        expect(isConfigured(['size-l'], [['size-l']])).toBe(false);
        expect(branchPathLabel(axes, lPilled.styleIds)).toBe('size: l · shape: pilled');
    });

    it('выносит пересечения с пропуском уровня из дерева', () => {
        const skipping = ['view-accent', 'size-l'];
        const withoutFirst = ['shape-pilled', 'view-default'];
        const path = ['size-m', 'shape-pilled', 'view-default'];

        expect(isTreePath(axes, skipping)).toBe(false);
        expect(isTreePath(axes, withoutFirst)).toBe(false);
        expect(isTreePath(axes, path)).toBe(true);
        expect(offTreeCombinations(axes, [skipping, path, withoutFirst])).toEqual([skipping, withoutFirst]);
        expect(branchPathLabel(axes, skipping)).toBe('size: l · view: accent');
        const [, l] = treeChildren(axes);
        expect(configuredWithin(axes, l, [skipping])).toEqual([]);
    });
});
