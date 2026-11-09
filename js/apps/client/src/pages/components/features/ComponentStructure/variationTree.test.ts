import { describe, expect, it } from 'vitest';

import type { EditorAxisDto } from '../../../../api/editorContracts';

import { branchPathLabel, configuredWithin, isConfigured, treeAxes, treeChildren } from './variationTree';

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

    it('в корне — значения всех вариаций, в ветке — значения вариаций после неё', () => {
        expect(treeChildren(axes).map((branch) => branch.styleIds)).toEqual([
            ['size-m'],
            ['size-l'],
            ['shape-pilled'],
            ['view-default'],
            ['view-accent'],
        ]);
        const shape = treeChildren(axes).find((branch) => branch.value.name === 'pilled')!;
        expect(treeChildren(axes, shape).map((branch) => branch.styleIds)).toEqual([
            ['shape-pilled', 'view-default'],
            ['shape-pilled', 'view-accent'],
        ]);
        const last = treeChildren(axes).find((branch) => branch.value.name === 'accent')!;
        expect(treeChildren(axes, last)).toEqual([]);
    });

    it('находит настроенные пересечения в поддереве и в самой ветке', () => {
        const configured = [['size-l', 'shape-pilled']];
        const [m, l, pilled] = treeChildren(axes);

        expect(configuredWithin(axes, l, configured)).toEqual(configured);
        expect(configuredWithin(axes, m, configured)).toEqual([]);
        // Пересечение с `size` не лежит под `shape: pilled` корня: там только сочетания без `size`.
        expect(configuredWithin(axes, pilled, configured)).toEqual([]);

        const lPilled = treeChildren(axes, l).find((branch) => branch.value.name === 'pilled')!;
        expect(isConfigured(lPilled.styleIds, configured)).toBe(true);
        expect(isConfigured(['size-l'], [['size-l']])).toBe(false);
        expect(branchPathLabel(axes, lPilled.styleIds)).toBe('size: l · shape: pilled');
    });
});
