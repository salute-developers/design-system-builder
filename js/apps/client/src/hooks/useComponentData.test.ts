import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Config } from '../controllers';
import type { Meta } from '../controllers';
import { getDefaultProps, keepSelection, useComponentData } from './useComponentData';

const style = (id: string) => ({ id, name: id, intersections: null, props: [] });

const meta = (platform: 'web' | 'compose', defaults: Array<{ variationID: string; styleID: string }>): Meta => ({
    name: 'TabBar',
    description: 'TabBar',
    platform,
    sources: {
        variations: [
            { id: 'axis-size', name: 'size' },
            { id: 'axis-view', name: 'view' },
        ],
        api: [],
        configs: [
            {
                id: 'default',
                name: 'default',
                config: {
                    defaultVariations: defaults,
                    invariantProps: [],
                    variations: [
                        { id: 'axis-size', styles: [style('m'), style('l')] },
                        { id: 'axis-view', styles: [style('accent'), style('default')] },
                    ],
                },
            },
        ],
    },
});

describe('getDefaultProps', () => {
    it('selects the first style of a Compose variation that has no default', () => {
        const config = new Config(meta('compose', [{ variationID: 'axis-size', styleID: 'm' }]));

        expect(getDefaultProps(config)).toEqual({ size: 'm', view: 'accent' });
    });

    it('keeps the declared defaults of a Compose variation', () => {
        const config = new Config(
            meta('compose', [
                { variationID: 'axis-size', styleID: 'l' },
                { variationID: 'axis-view', styleID: 'default' },
            ]),
        );

        expect(getDefaultProps(config)).toEqual({ size: 'l', view: 'default' });
    });

    it('selects nothing extra for a web component that declares defaults', () => {
        const config = new Config(meta('web', [{ variationID: 'axis-size', styleID: 'm' }]));

        expect(getDefaultProps(config)).toEqual({ size: 'm' });
    });

    it('selects the first style of every variation when no defaults are declared', () => {
        const config = new Config(meta('web', []));

        expect(getDefaultProps(config)).toEqual({ size: 'm', view: 'accent' });
    });
});

describe('keepSelection', () => {
    const known = new Set(['size', 'view']);

    it('keeps existing styles, a switched-off variation and replaces a removed style with the default', () => {
        const config = new Config(meta('web', [{ variationID: 'axis-size', styleID: 'm' }]));

        expect(keepSelection(config, { size: 'l', view: 'accent' }, { size: 'm' }, known)).toEqual({
            size: 'l',
            view: 'accent',
        });
        expect(keepSelection(config, { view: 'accent' }, { size: 'm' }, known)).toEqual({ view: 'accent' });
        expect(keepSelection(config, { size: 'removed' }, { size: 'm' }, known)).toEqual({ size: 'm' });
        expect(keepSelection(config, { view: 'removed' }, { size: 'm' }, known)).toEqual({});
    });

    it('puts a variation that had nothing to select before on its default style', () => {
        const config = new Config(meta('web', [{ variationID: 'axis-size', styleID: 'm' }]));

        expect(keepSelection(config, {}, { size: 'm' }, new Set())).toEqual({ size: 'm' });
    });
});

describe('useComponentData', () => {
    it('selects the default styles once the component placeholder is replaced by the loaded model', () => {
        // Пока компонент грузится, у модели есть вариации, но нет стилей.
        const placeholder = new Config({ ...meta('web', []), sources: { ...meta('web', []).sources, configs: [] } });
        const loaded = new Config(meta('web', [{ variationID: 'axis-size', styleID: 'm' }]));
        const { result, rerender } = renderHook(({ config }) => useComponentData(config), {
            initialProps: { config: placeholder },
        });
        expect(result.current[0]).toEqual({});

        rerender({ config: loaded });

        expect(result.current[0]).toEqual({ size: 'm' });
    });

    it('keeps a style added in the editor selected after reload replaces its temporary ID with the server one', () => {
        const loaded = new Config(meta('web', [{ variationID: 'axis-view', styleID: 'default' }]));
        const { result, rerender } = renderHook(({ config }) => useComponentData(config), {
            initialProps: { config: loaded },
        });
        // Редактор добавляет стиль в тот же экземпляр модели с временным ID и выбирает его.
        loaded.addVariationStyle([], 'axis-view', 'brand');
        const added = loaded
            .getVariations()
            .find((variation) => variation.getID() === 'axis-view')
            ?.getStyles()
            ?.find((item) => item.getName() === 'brand');
        act(() => result.current[1]((current) => ({ ...current, view: added!.getID() })));

        const base = meta('web', [{ variationID: 'axis-view', styleID: 'default' }]);
        const reloaded = new Config({
            ...base,
            sources: {
                ...base.sources,
                configs: base.sources.configs.map((item) => ({
                    ...item,
                    config: {
                        ...item.config,
                        variations: item.config.variations.map((variation) =>
                            variation.id === 'axis-view'
                                ? {
                                      ...variation,
                                      styles: [
                                          ...(variation.styles ?? []),
                                          { ...style('server-brand'), name: 'brand' },
                                      ],
                                  }
                                : variation,
                        ),
                    },
                })),
            },
        });
        rerender({ config: reloaded });

        expect(result.current[0].view).toBe('server-brand');
    });
});
