import { describe, expect, it } from 'vitest';

import { Config } from '../../../../controllers';
import type { Meta } from '../../../../controllers';
import { chipMeta, style } from '../__fixtures__/chipMeta';
import {
    collectProperties,
    combinationTitle,
    editSource,
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
        expect(sectionOf('icon', 'closeIcon')).toBe('Icons');
        expect(sectionOf('component_style', 'buttonStyle')).toBe('Nested styles');
        // Сырой CSS раскладывается по имени.
        expect(sectionOf('value', 'width')).toBe('Size');
        expect(sectionOf('value', 'backgroundColor')).toBe('Color');
        expect(sectionOf('value', 'avatarSize')).toBe('Layout');
        expect(sectionOf('value', 'statusLeft')).toBe('Layout');
        expect(sectionOf(undefined, 'width')).toBeUndefined();
    });
});

describe('compareProperties', () => {
    it('puts the prototype primary rows first, then sorts by label', () => {
        const config = new Config(meta);
        const names = collectProperties(config, { size: 's-m' })
            .sort(compareProperties)
            .map(({ prop }) => prop.getName());

        expect(names).toEqual(['height', 'padding', 'radius', 'typography']);
    });
});

describe('editSource', () => {
    it('edits the invariant when nothing is selected', () => {
        expect(editSource(new Config(meta), {})).toEqual({ kind: 'invariant' });
    });

    it('edits the style of the only selected value, a flag included', () => {
        const config = new Config(meta);

        expect(editSource(config, { view: 'v-accent' })).toMatchObject({
            kind: 'style',
            variationID: 'v-view',
            styleID: 'v-accent',
        });
        expect(editSource(config, { pilled: 'p-true' })).toMatchObject({ kind: 'style', styleID: 'p-true' });
    });

    it('edits the intersection of two and more selected values', () => {
        const source = editSource(new Config(meta), { size: 's-xs', view: 'v-accent' });

        expect(source).toMatchObject({ kind: 'combination', styleIDs: ['s-xs', 'v-accent'] });
        expect(sourceLabel(source)).toBe('size: xs · view: accent');
    });

    it('skips an unknown style as not selected', () => {
        expect(editSource(new Config(meta), { size: 'gone', view: 'v-accent' })).toMatchObject({
            kind: 'style',
            styleID: 'v-accent',
        });
    });
});

describe('collectProperties', () => {
    it('shows the values of the edited source only', () => {
        const config = new Config(meta);
        const rows = (selection: Record<string, string>) =>
            collectProperties(config, selection).map(
                ({ prop, source, section }) => `${prop.getName()}|${sourceLabel(source)}|${section}`,
            );

        // `width` — сырой CSS (`value`): виден в Size, как и прочие свойства источника.
        expect(rows({})).toEqual([
            'closeIcon|Инвариант|Icons',
            'disabledOpacity|Инвариант|Color',
            'width|Инвариант|Size',
        ]);
        expect(rows({ view: 'v-accent' })).toEqual(['background|view: accent|Color']);
        expect(rows({ pilled: 'p-true' })).toEqual(['pilledBorderRadius|pilled: true|Appearance']);
    });

    it('keeps the same property list for every source, one row per property', () => {
        const config = new Config(meta);
        const api = meta.sources.api;
        const ids = (selection: Record<string, string>) =>
            collectProperties(config, selection, api)
                .map(({ prop }) => prop.getID())
                .sort();

        const invariant = ids({});
        expect(new Set(invariant).size).toBe(invariant.length);
        expect(ids({ size: 's-m' })).toEqual(invariant);
        expect(ids({ view: 'v-accent' })).toEqual(invariant);
        expect(ids({ size: 's-m', view: 'v-accent' })).toEqual(invariant);
    });

    it('marks properties of another variation as unlinked for a style, linked by name or ID', () => {
        const rows = collectProperties(new Config(meta), { size: 's-xs' }, meta.sources.api);

        expect(rows.find((row) => row.prop.getName() === 'height')).toMatchObject({ isSet: false, linked: true });
        expect(rows.find((row) => row.prop.getName() === 'background')).toMatchObject({ isSet: false, linked: false });
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

        expect(collectProperties(config, { size: 'm' }).map(({ prop }) => prop.getID())).toEqual(['focus']);
    });

    it('does not touch the model for empty rows', () => {
        const config = new Config(meta);
        const revision = config.getRevision();

        collectProperties(config, { size: 's-m' }, meta.sources.api);

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

describe('collectProperties for an intersection', () => {
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

    it('shows the values of the intersection of the selected styles', () => {
        const rows = collectProperties(new Config(withCombination), { size: 's-m', pilled: 'p-true' }, api);
        const height = rows.find((row) => row.prop.getName() === 'height');

        expect(height).toMatchObject({ isSet: true, source: { kind: 'combination', styleIDs: ['s-m', 'p-true'] } });
        expect(height?.prop.getValue()).toBe('44');
        expect(rows.filter((row) => row.prop.getName() === 'height')).toHaveLength(1);
        expect(rows.every((row) => row.source.kind === 'combination' && row.linked)).toBe(true);
    });

    it('starts empty for an intersection without values', () => {
        const rows = collectProperties(new Config(withCombination), { size: 's-xs', pilled: 'p-true' }, api);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => !row.isSet)).toBe(true);
    });
});
