import { describe, expect, it } from 'vitest';

import { Config } from '../../../../controllers';
import type { Meta } from '../../../../controllers';
import { chipMeta, style } from '../__fixtures__/chipMeta';
import {
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
                                { id: 'size', styles: [style('m', 'm', [{ id: 'focus', value: 'textAccent' }])] },
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

        expect(fallbackStyle(config, 'size')).toBe('s-m');
        config.removeDefault('size');
        expect(fallbackStyle(config, 'size')).toBe('s-xs');
    });
});
