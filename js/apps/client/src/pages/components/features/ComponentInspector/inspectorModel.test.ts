import { describe, expect, it } from 'vitest';

import { Config } from '../../../../controllers';
import type { Meta } from '../../../../controllers';
import { chipMeta, style } from '../__fixtures__/chipMeta';
import {
    collectCombinationProperties,
    collectSourceProperties,
    combinationTitle,
    compareProperties,
    fallbackStyle,
    orderedVariations,
    sectionOf,
    sourceLabel,
} from './inspectorModel';

const meta = chipMeta;

const selection = { size: 's-m', view: 'v-default', pilled: 'p-true' };

describe('sectionOf', () => {
    it('places properties by the prototype rule, first match wins', () => {
        expect(sectionOf('shadow', 'shadow')).toBe('Effects');
        expect(sectionOf('dimension', 'blurRadius')).toBe('Effects');
        expect(sectionOf('shape', 'shape')).toBe('Appearance');
        expect(sectionOf('dimension', 'pilledBorderRadius')).toBe('Appearance');
        expect(sectionOf('dimension', 'borderWidth')).toBe('Border');
        expect(sectionOf('color', 'outlineColor')).toBe('Border');
        expect(sectionOf('color', 'background')).toBe('Color');
        expect(sectionOf('float', 'disabledOpacity')).toBe('Color');
        expect(sectionOf('typography', 'typography')).toBe('Text');
        expect(sectionOf('dimension', 'height')).toBe('Size');
        expect(sectionOf('dimension', 'minWidth')).toBe('Size');
        expect(sectionOf('dimension', 'padding')).toBe('Layout');
        expect(sectionOf('icon', 'closeIcon')).toBe('Additional');
        expect(sectionOf('component_style', 'buttonStyle')).toBe('Additional');
        expect(sectionOf('value', 'width')).toBeUndefined();
    });
});

describe('compareProperties', () => {
    it('puts the prototype primary rows first, then sorts by label', () => {
        const config = new Config(meta);
        const names = collectSourceProperties(config, selection)
            .sort(compareProperties)
            .map(({ prop }) => prop.getName());

        expect(names).toEqual([
            'height',
            'padding',
            'radius',
            'typography',
            'background',
            'closeIcon',
            'disabledOpacity',
            'pilledBorderRadius',
        ]);
    });
});

describe('collectSourceProperties', () => {
    it('collects invariants and the selected style of every variation in the combination', () => {
        const config = new Config(meta);

        const rows = collectSourceProperties(config, selection).map(
            ({ prop, source, section }) => `${prop.getName()}|${sourceLabel(source)}|${section}`,
        );

        expect(rows).toEqual([
            'closeIcon|Инвариант|Additional',
            'disabledOpacity|Инвариант|Color',
            'height|size: m|Size',
            'padding|size: m|Layout',
            'radius|size: m|Appearance',
            'typography|size: m|Text',
            'background|view: default|Color',
            'pilledBorderRadius|pilled: true|Appearance',
        ]);
    });

    it('drops the properties of a switched-off flag', () => {
        const config = new Config(meta);

        const names = collectSourceProperties(config, { size: 's-m', view: 'v-accent' }).map(({ prop }) =>
            prop.getName(),
        );

        expect(names).not.toContain('pilledBorderRadius');
        expect(collectSourceProperties(config, { view: 'v-accent' }).at(-1)?.prop.getValue()).toBe('surfaceAccent');
    });

    it('keeps a style value whose type is absent from the variation API', () => {
        const config = new Config({
            ...meta,
            sources: {
                ...meta.sources,
                configs: [
                    {
                        id: 'config',
                        config: {
                            defaultVariations: [],
                            invariantProps: [],
                            variations: [
                                { id: 'v-size', styles: [style('m', 'm', [{ id: 'focus', value: 'textAccent' }])] },
                            ],
                        },
                    },
                ],
            },
        } as unknown as Meta);

        expect(collectSourceProperties(config, { size: 'm' }).map(({ prop }) => prop.getID())).toEqual(['focus']);
    });
});

describe('collectSourceProperties with API', () => {
    it('adds unset API properties of every source as empty rows, except style links and icons', () => {
        const config = new Config(meta);

        const empty = collectSourceProperties(config, selection, meta.sources.api)
            .filter((item) => !item.isSet)
            .map(
                ({ prop, source, section }) =>
                    `${prop.getName()}|${sourceLabel(source)}|${section}|${prop.getValue() ?? ''}`,
            );

        expect(empty).toEqual(['focusColor|Инвариант|Color|', 'color|view: default|Color|']);
    });

    it('does not touch the model for empty rows', () => {
        const config = new Config(meta);
        const revision = config.getRevision();

        collectSourceProperties(config, selection, meta.sources.api);

        expect(config.getInvariants()?.getProp('focus')).toBeUndefined();
        expect(config.getRevision()).toBe(revision);
    });
});

describe('combinationTitle', () => {
    it('writes size in capitals, other styles capitalised and skips flags', () => {
        const config = new Config(meta);

        expect(orderedVariations(config).map((variation) => variation.getName())).toEqual(['size', 'view', 'pilled']);
        expect(combinationTitle(config, selection)).toBe('Chip M Default');
        expect(combinationTitle(config, { size: 's-xs' })).toBe('Chip XS');
    });
});

describe('fallbackStyle', () => {
    it('prefers the default style and falls back to the first one', () => {
        const config = new Config(meta);

        expect(fallbackStyle(config, 'v-size')).toBe('s-m');
        config.removeDefault('v-size');
        expect(fallbackStyle(config, 'v-size')).toBe('s-xs');
    });
});

describe('collectSourceProperties: links of properties to variations', () => {
    it('matches a link by the variation name, not only by its ID', () => {
        const rows = collectSourceProperties(new Config(meta), { size: 's-xs' }, meta.sources.api);
        const height = rows.find((row) => row.prop.getName() === 'height');

        expect(height).toMatchObject({
            isSet: false,
            source: { kind: 'style', variationID: 'v-size', styleID: 's-xs' },
        });
    });

    it('does not treat properties as invariants when the component has no links at all', () => {
        const api = meta.sources.api.map((item) => ({ ...item, variations: null }));
        const rows = collectSourceProperties(
            new Config({ ...meta, sources: { ...meta.sources, api } } as Meta),
            selection,
            api,
        );

        expect(rows.filter((row) => !row.isSet)).toEqual([]);
        expect(rows.filter((row) => row.prop.getName() === 'height')).toEqual([
            expect.objectContaining({
                isSet: true,
                source: expect.objectContaining({ kind: 'style', styleID: 's-m' }),
            }),
        ]);
    });
});

describe('collectSourceProperties for structure changes', () => {
    // Chip с новой вариацией `density` (ни привязок, ни значений) и вариацией `legacy`: значения есть, привязок нет.
    const withVariations = () => {
        const base = chipMeta.sources.configs[0].config;
        return {
            ...chipMeta,
            sources: {
                ...chipMeta.sources,
                variations: [
                    ...chipMeta.sources.variations,
                    { id: 'density', name: 'density' },
                    { id: 'legacy', name: 'legacy' },
                ],
                configs: [
                    {
                        ...chipMeta.sources.configs[0],
                        config: {
                            ...base,
                            variations: [
                                ...base.variations,
                                { id: 'density', styles: [style('d-compact', 'compact')] },
                                { id: 'legacy', styles: [style('l-on', 'on', [{ id: 'padding', value: '2' }])] },
                            ],
                        },
                    },
                ],
            },
        } as unknown as Meta;
    };
    const rows = (selection: Record<string, string>, showAll = false) => {
        const meta = withVariations();
        return collectSourceProperties(new Config(meta), selection, meta.sources.api, showAll);
    };

    it('shows every component property to a style of a new variation, unlinked', () => {
        const density = rows({ size: 's-m', density: 'd-compact' }).filter(
            (item) => item.source.kind === 'style' && item.source.variationID === 'density',
        );

        expect(density.map((item) => item.prop.getName())).toEqual(
            expect.arrayContaining(['background', 'height', 'padding']),
        );
        expect(density.every((item) => !item.isSet && !item.linked)).toBe(true);
    });

    it('does not expand an old variation without links and keeps other styles to linked properties', () => {
        const result = rows({ size: 's-m', legacy: 'l-on' });

        expect(
            result
                .filter((item) => item.source.kind === 'style' && item.source.variationID === 'legacy')
                .map((item) => item.prop.getName()),
        ).toEqual(['padding']);
        expect(
            result
                .filter((item) => item.source.kind === 'style' && item.source.variationID === 'v-size')
                .every((item) => item.linked),
        ).toBe(true);
    });

    it('adds unlinked properties as empty rows when all properties are shown', () => {
        const size = rows({ size: 's-m' }, true).filter(
            (item) => item.source.kind === 'style' && item.source.variationID === 'v-size',
        );

        expect(size.find((item) => item.prop.getName() === 'background')).toMatchObject({
            isSet: false,
            linked: false,
        });
        expect(size.find((item) => item.prop.getName() === 'height')).toMatchObject({ isSet: true, linked: true });
    });
});

describe('Config configurations', () => {
    it('lists configurations, opens another one and names variations by the configuration axis', () => {
        const meta = {
            ...chipMeta,
            sources: {
                ...chipMeta.sources,
                configs: [
                    { ...chipMeta.sources.configs[0], id: 'base', name: 'Chip', isDefault: true },
                    {
                        id: 'copy',
                        name: 'Chip copy',
                        config: {
                            defaultVariations: [],
                            invariantProps: [],
                            variations: [{ id: 'view', name: 'tone', styles: [style('v-default', 'brand')] }],
                        },
                    },
                ],
            },
        } as unknown as Meta;
        const config = new Config(meta);

        expect(config.getConfigurations()).toEqual([
            { id: 'base', name: 'Chip', isDefault: true },
            { id: 'copy', name: 'Chip copy', isDefault: false },
        ]);
        expect(config.getConfigurationId()).toBe('base');
        const copy = config.withConfiguration('copy');
        expect(copy.getConfigurationId()).toBe('copy');
        expect(copy.getVariations().map((variation) => variation.getName())).toEqual(['tone']);
    });
});

describe('collectCombinationProperties', () => {
    const withCombination = {
        ...chipMeta,
        sources: {
            ...chipMeta.sources,
            configs: [
                {
                    ...chipMeta.sources.configs[0],
                    config: {
                        ...chipMeta.sources.configs[0].config,
                        combinations: [{ styleIDs: ['s-m', 'p-true'], props: [{ id: 'height', value: '44' }] }],
                    },
                },
            ],
        },
    } as Meta;
    const api = withCombination.sources.api;

    it('shows the values of the intersection and empty rows for properties of its variations', () => {
        const rows = collectCombinationProperties(new Config(withCombination), ['p-true', 's-m'], api);
        const height = rows.find((row) => row.prop.getName() === 'height');

        expect(height).toMatchObject({ isSet: true, source: { kind: 'combination', styleIDs: ['p-true', 's-m'] } });
        expect(height?.prop.getValue()).toBe('44');
        expect(sourceLabel(height!.source)).toBe('pilled: true · size: m');
        // Свойства `view` к сочетанию не относятся.
        expect(rows.some((row) => row.prop.getName() === 'background')).toBe(false);
        expect(rows.filter((row) => !row.isSet).every((row) => row.source.kind === 'combination')).toBe(true);
    });

    it('starts empty for an intersection without values', () => {
        const rows = collectCombinationProperties(new Config(withCombination), ['s-xs', 'p-true'], api);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => !row.isSet)).toBe(true);
    });
});
