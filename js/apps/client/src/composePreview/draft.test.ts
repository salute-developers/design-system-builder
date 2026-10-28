import { describe, expect, it } from 'vitest';

import { Config } from '../controllers/componentBuilder';
import type { Meta } from '../controllers/componentBuilder/type';
import { buildMockTheme } from '../controllers/themeBuilder/themes/builders';
import { createComponentPreviewDraft } from './draft';
import { resolveStyleReference } from '../controllers/componentBuilder';
import { buttonMeta, groupMeta } from './nestedStyleFixture';
import { restorePaletteColor } from '../palette/activePalette';

const componentMeta = (): Meta => ({
    name: 'Button',
    description: 'Button',
    preview: {
        compose: {
            componentId: 'BasicButton',
            storyId: 'BasicButton',
        },
    },
    sources: {
        variations: [{ id: 'axis-density', name: 'density' }],
        api: [
            {
                id: 'background',
                name: 'background',
                type: 'color',
                variations: null,
                platformMappings: { compose: 'backgroundColor, contentColor', web: [], xml: null, ios: null },
            },
            {
                id: 'height',
                name: 'height',
                type: 'dimension',
                variations: ['axis-density'],
                platformMappings: { compose: 'height', web: [], xml: null, ios: null },
            },
        ],
        configs: [
            {
                id: 'BasicButton',
                name: 'default',
                config: {
                    defaultVariations: [{ variationID: 'axis-density', styleID: 'compact' }],
                    invariantProps: [
                        {
                            id: 'background',
                            value: 'color.background',
                            states: [{ state: ['pressed'], value: 'color.background.pressed' }],
                            adjustment: 1,
                        },
                    ],
                    variations: [
                        {
                            id: 'axis-density',
                            styles: [
                                {
                                    id: 'compact',
                                    name: 'Compact',
                                    intersections: null,
                                    props: [{ id: 'height', value: 40 }],
                                },
                                {
                                    id: 'comfortable',
                                    name: 'Comfortable',
                                    intersections: null,
                                    props: [{ id: 'height', value: 48 }],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    },
});

describe('createComponentPreviewDraft', () => {
    it('projects arbitrary variations, selected style, invariants, states, mappings and example props', () => {
        const result = createComponentPreviewDraft({
            config: new Config(componentMeta()),
            theme: buildMockTheme(),
            args: { density: 'comfortable', text: 'Continue', loading: true },
            themeMode: 'light',
            themeValuePlatform: 'web',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.draft.componentId).toBe('BasicButton');
        expect(result.draft.storyId).toBe('BasicButton');
        expect(result.draft.variationSelections).toEqual({ 'axis-density': 'comfortable' });
        expect(result.draft.example.props).toEqual({ text: 'Continue', loading: true });
        expect(result.draft.selectedStyleProperties).toEqual([
            expect.objectContaining({
                id: 'height',
                type: 'dimension',
                composeParameters: ['height'],
                value: 48,
            }),
        ]);
        expect(result.draft.invariantProperties).toEqual([
            expect.objectContaining({
                id: 'background',
                type: 'color',
                composeParameters: ['backgroundColor', 'contentColor'],
                states: [{ names: ['pressed'], value: 'color.background.pressed' }],
                adjustment: 1,
            }),
        ]);
        expect(() => JSON.stringify(result.draft)).not.toThrow();
    });

    it('passes gradient and shadow theme tokens to the draft', () => {
        const result = createComponentPreviewDraft({
            config: new Config(componentMeta()),
            theme: buildMockTheme(),
            args: {},
            themeMode: 'light',
            themeValuePlatform: 'android',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const types = new Set(result.draft.themeTokens.map((token) => token.type));
        expect(types.has('gradient') || types.has('shadow')).toBe(true);
    });

    it('projects solid platform values and palette references of a gradient family', () => {
        const theme = buildMockTheme();
        const [token] = theme.getTokens().gradient as never as Array<{
            getName(): string;
            setValue(platform: string, value: unknown): void;
        }>;
        const resolved = (reference: string) => restorePaletteColor(reference, -1, token.getName());
        token.setValue('android', [
            { kind: 'linear', locations: [0, 1], colors: ['[general.red.500]', '#000000'], angle: 90 },
            { kind: 'color', background: '[general.blue.300]' },
        ]);
        token.setValue('ios', '[general.red.500][0.5]');
        token.setValue('web', ['#123456']);

        const result = createComponentPreviewDraft({
            config: new Config(componentMeta()),
            theme,
            args: {},
            themeMode: 'light',
            themeValuePlatform: 'android',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const values = result.draft.themeTokens.find((item) => item.id === token.getName())!.values;
        expect(values).toEqual({
            android: [
                { kind: 'linear', locations: [0, 1], colors: [resolved('[general.red.500]'), '#000000'], angle: 90 },
                { kind: 'color', background: resolved('[general.blue.300]') },
            ],
            ios: [{ kind: 'color', background: resolved('[general.red.500][0.5]') }],
            web: [{ kind: 'color', background: '#123456' }],
        });
        expect(JSON.stringify(values)).not.toContain('[general.');
    });

    it('uses configured defaults and reports unavailable stable metadata', () => {
        const withDefault = createComponentPreviewDraft({
            config: new Config(componentMeta()),
            theme: buildMockTheme(),
            args: { text: 'Default' },
            themeMode: 'dark',
            themeValuePlatform: 'android',
            surface: { width: 100, height: 50, background: '#000000FF' },
        });
        expect(withDefault).toMatchObject({
            ok: true,
            draft: {
                variationSelections: { 'axis-density': 'compact' },
                themeMode: 'dark',
                themeValuePlatform: 'android',
            },
        });

        const missing = componentMeta();
        delete missing.preview;
        missing.sources.configs = [];
        expect(
            createComponentPreviewDraft({
                config: new Config(missing),
                theme: buildMockTheme(),
                args: {},
                themeMode: 'light',
                themeValuePlatform: 'web',
                surface: { width: 100, height: 50, background: '#FFFFFFFF' },
            }),
        ).toMatchObject({
            ok: false,
            diagnostics: [{ code: 'missing_metadata' }],
        });
    });


    it('accepts stable runtime IDs supplied by loaded plugin metadata', () => {
        const meta = componentMeta();
        meta.sources.configs[0].id = 'database-config-id';
        const result = createComponentPreviewDraft({
            config: new Config(meta),
            theme: buildMockTheme(),
            previewMetadata: { componentId: 'BasicButton', storyId: 'BasicButton' },
            args: { density: 'compact' },
            themeMode: 'light',
            themeValuePlatform: 'web',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });

        expect(result).toMatchObject({
            ok: true,
            draft: {
                componentId: 'BasicButton',
                storyId: 'BasicButton',
                example: { id: 'BasicButton' },
            },
        });
    });

    it('marks intentionally platform-specific properties separately from missing metadata', () => {
        const meta = componentMeta();
        meta.sources.api.push({
            id: 'web-only',
            name: 'webOnly',
            type: 'color',
            variations: null,
            platformMappings: {
                compose: null,
                web: [{ name: 'buttonWebOnly', adjustment: null }],
                xml: null,
                ios: null,
            },
        });
        meta.sources.configs[0].config.invariantProps.push({
            id: 'web-only',
            value: 'color.web-only',
        });
        const result = createComponentPreviewDraft({
            config: new Config(meta),
            theme: buildMockTheme(),
            previewMetadata: { componentId: 'BasicButton', storyId: 'BasicButton' },
            args: { density: 'compact' },
            themeMode: 'light',
            themeValuePlatform: 'web',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });

        expect(result).toMatchObject({
            ok: true,
            draft: {
                invariantProperties: expect.arrayContaining([
                    expect.objectContaining({
                        id: 'web-only',
                        composeParameters: [],
                        hasNonComposeMappings: true,
                    }),
                ]),
            },
        });
    });

    it('keeps variation and explicit story property with the same name in separate namespaces', () => {
        const meta = componentMeta();
        meta.sources.variations[0].name = 'shape';
        const result = createComponentPreviewDraft({
            config: new Config(meta),
            theme: buildMockTheme(),
            previewMetadata: { componentId: 'BasicButton', storyId: 'BasicButton' },
            args: {},
            variationSelections: { shape: 'comfortable' },
            exampleProps: { shape: 'Story shape value' },
            themeMode: 'light',
            themeValuePlatform: 'web',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });

        expect(result).toMatchObject({
            ok: true,
            draft: {
                variationSelections: { 'axis-density': 'comfortable' },
                example: { props: { shape: 'Story shape value' } },
            },
        });
    });
});

describe('createComponentPreviewDraft: flag variations', () => {
    // Флаг (`pilled`): единственный стиль `true`; выключенный флаг в редакторе — отсутствие аргумента.
    const flagMeta = (): Meta => ({
        name: 'Chip',
        description: 'Chip',
        preview: { compose: { componentId: 'Chip', storyId: 'Chip' } },
        sources: {
            variations: [{ id: 'pilled', name: 'pilled' }],
            api: [
                {
                    id: 'radius',
                    name: 'radius',
                    type: 'dimension',
                    variations: ['pilled'],
                    platformMappings: { compose: 'radius', web: [], xml: null, ios: null },
                },
            ],
            configs: [
                {
                    id: 'cfg',
                    name: 'chip',
                    config: {
                        defaultVariations: [{ variationID: 'pilled', styleID: 'pilled-true' }],
                        invariantProps: [],
                        variations: [
                            {
                                id: 'pilled',
                                styles: [
                                    {
                                        id: 'pilled-true',
                                        name: 'true',
                                        intersections: null,
                                        props: [{ id: 'radius', value: '99' }],
                                    },
                                ],
                            },
                        ],
                    },
                },
            ],
        },
    });
    const draftOf = (variationSelections: Record<string, unknown> | undefined, args: Record<string, unknown> = {}) => {
        const result = createComponentPreviewDraft({
            config: new Config(flagMeta()),
            theme: buildMockTheme(),
            args,
            variationSelections,
            themeMode: 'light',
            themeValuePlatform: 'android',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });
        if (!result.ok) throw new Error('draft failed');
        return result.draft;
    };

    it('keeps the default style of a flag when the selections are not given explicitly', () => {
        expect(draftOf(undefined).selectedStyleProperties.map((item) => item.id)).toEqual(['radius']);
    });

    it('selects a flag that is present in the explicit selections', () => {
        expect(draftOf({ pilled: 'pilled-true' }).selectedStyleProperties.map((item) => item.id)).toEqual(['radius']);
    });

    it('treats a flag missing from the explicit selections as switched off', () => {
        const draft = draftOf({});

        expect(draft.variationSelections).toEqual({});
        expect(draft.selectedStyleProperties).toEqual([]);
    });
});

describe('createComponentPreviewDraft: combinations and nested styles', () => {
    const draftOf = (selections: Record<string, string>, withResolver = true) => {
        const metas = [groupMeta(), buttonMeta()];
        const result = createComponentPreviewDraft({
            config: new Config(groupMeta()),
            theme: buildMockTheme(),
            previewMetadata: { componentId: 'ButtonGroup', storyId: 'ButtonGroup' },
            args: {},
            variationSelections: selections,
            themeMode: 'light',
            themeValuePlatform: 'android',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
            resolveStyleReference: withResolver ? (reference) => resolveStyleReference(metas, reference) : undefined,
        });
        if (!result.ok) throw new Error('draft failed');
        return result.draft;
    };

    it('applies the value of the combination whose styles are all selected', () => {
        const wide = draftOf({ size: 'group-xxs', gap: 'gap-wide', shape: 'shape-default' });
        const dense = draftOf({ size: 'group-xxs', gap: 'gap-dense', shape: 'shape-default' });

        expect(wide.selectedStyleProperties.find((item) => item.id === 'spacing')?.value).toBe('8');
        expect(dense.selectedStyleProperties.find((item) => item.id === 'spacing')?.value).toBe('2');
        expect(wide.selectedStyleProperties.find((item) => item.id === 'shape')?.value).toBe('12');
    });

    it('ignores a combination with an unselected style', () => {
        const draft = draftOf({ size: 'group-xxs' });

        expect(draft.selectedStyleProperties.find((item) => item.id === 'spacing')).toBeUndefined();
    });

    it('turns a style reference into a nested style with the target properties', () => {
        const draft = draftOf({ size: 'group-xxs', gap: 'gap-wide', shape: 'shape-default' });

        const reference = draft.selectedStyleProperties.find((item) => item.id === 'buttonStyle');
        expect(reference).toMatchObject({ styleRef: 'basic-button.xxs.default', value: undefined });
        expect(draft.styles).toEqual([
            {
                id: 'basic-button.xxs.default',
                componentId: 'BasicButton',
                properties: [expect.objectContaining({ id: 'height', value: '24' })],
            },
        ]);
    });

    it('skips a reference that cannot be resolved instead of sending it as a token', () => {
        const draft = draftOf({ size: 'group-xxs' }, false);

        expect(draft.selectedStyleProperties.find((item) => item.id === 'buttonStyle')).toBeUndefined();
        expect(draft.styles).toBeUndefined();
    });
});
