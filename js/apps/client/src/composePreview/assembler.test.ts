import { describe, expect, it } from 'vitest';

import { assembleComposePreviewPayload } from './assembler';
import type { ComponentPreviewDraft, PreviewPropertyDraft } from './draft';
import { createPreviewDraftFixture } from './testDraftFixture';

const draft = (): ComponentPreviewDraft => createPreviewDraftFixture();

describe('assembleComposePreviewPayload', () => {
    it('assembles deterministic properties, states, theme closure and font assets', () => {
        const result = assembleComposePreviewPayload(draft());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.component.variations).toEqual({ customAxis: 'rounded' });
        expect(result.payload.component.properties.backgroundColor.states).toEqual([
            { when: ['pressed'], source: { type: 'tokenRef', tokenId: 'color.pressed' } },
        ]);
        expect(result.payload.component.properties.disabledAlpha.base).toEqual({ type: 'literal', value: 0.4 });
        expect(result.payload.theme['color.background']).toEqual({ type: 'color', value: '#123456FF' });
        expect(result.payload.theme['typography.button']).toMatchObject({
            type: 'typography',
            fontFamilyTokenId: 'font.body',
        });
        expect(result.payload.theme['font.body']).toMatchObject({ type: 'fontFamily' });
        expect(result.payload.assets).toHaveLength(1);
    });

    it('lets the plugin fall back to the default font when a font file cannot be downloaded', () => {
        const result = assembleComposePreviewPayload(draft());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const family = result.payload.theme['font.body'];
        expect(family).toMatchObject({ type: 'fontFamily', allowFallback: true });
        expect(family.type === 'fontFamily' && family.faces.length).toBeGreaterThan(0);
    });

    it('rejects missing mappings, conflicts, cycles and unavailable platform values', () => {
        const missingMapping = draft();
        missingMapping.invariantProperties[0].composeParameters = [];
        expect(assembleComposePreviewPayload(missingMapping)).toMatchObject({
            ok: false,
            diagnostics: [{ code: 'missing_mapping' }],
        });

        const conflict = draft();
        conflict.invariantProperties.push({
            id: 'other',
            name: 'disabledAlpha',
            type: 'float',
            composeParameters: ['disabledAlpha'],
            value: 0.9,
            states: [],
        });
        expect(assembleComposePreviewPayload(conflict)).toMatchObject({
            ok: false,
            diagnostics: [{ code: 'property_conflict' }],
        });

        const wrongPlatform = draft();
        wrongPlatform.themeTokens[0].values = { android: '#123456' };
        expect(assembleComposePreviewPayload(wrongPlatform)).toMatchObject({
            ok: false,
            diagnostics: [{ code: 'missing_token' }],
        });

        const cycle = draft();
        const typography = cycle.themeTokens.find((token) => token.type === 'typography')!;
        typography.values.web = {
            fontFamilyRef: 'typography.button',
            fontSize: 16,
            lineHeight: 20,
            letterSpacing: 0,
            fontWeight: 400,
        };
        expect(assembleComposePreviewPayload(cycle)).toMatchObject({
            ok: false,
            diagnostics: [{ code: 'cycle' }],
        });

        const missingAsset = draft();
        const family = missingAsset.themeTokens.find((token) => token.type === 'fontFamily')!;
        family.values.web = {
            name: 'Body',
            fonts: [{ src: [], fontWeight: '400', fontStyle: 'normal' }],
        };
        expect(assembleComposePreviewPayload(missingAsset)).toMatchObject({
            ok: false,
            diagnostics: [{ code: 'missing_asset' }],
        });
    });

    it('ignores properties explicitly mapped only to other platforms', () => {
        const platformSpecific = draft();
        platformSpecific.invariantProperties.push({
            id: 'web-only',
            name: 'webOnly',
            type: 'color',
            composeParameters: [],
            hasNonComposeMappings: true,
            value: 'color.web-only',
            states: [],
        });

        const result = assembleComposePreviewPayload(platformSpecific);
        expect(result.ok).toBe(true);
    });

    it('lets a later variation override the same property without resolving the shadowed token', () => {
        const composed = draft();
        const shape = composed.invariantProperties.find((property) => property.id === 'shape')!;
        composed.invariantProperties = composed.invariantProperties.filter((property) => property.id !== 'shape');
        composed.selectedStyleProperties.push({ ...shape, value: 'shape.size' }, { ...shape, value: 'shape.pilled' });
        composed.themeTokens.push(
            { id: 'shape.size', type: 'shape', enabled: true, values: {} },
            { id: 'shape.pilled', type: 'shape', enabled: true, values: { web: 999 } },
        );

        const result = assembleComposePreviewPayload(composed);

        expect(result).toMatchObject({
            ok: true,
            payload: {
                component: {
                    properties: {
                        shape: { base: { type: 'tokenRef', tokenId: 'shape.pilled' } },
                    },
                },
                theme: {
                    'shape.pilled': { type: 'shape', cornerRadii: [999, 999, 999, 999] },
                },
            },
        });
        if (result.ok) expect(result.payload.theme['shape.size']).toBeUndefined();
    });

    it('applies the adjustment of a shape token through a derived theme token', () => {
        const adjusted = draft();
        const shape = adjusted.invariantProperties.find((property) => property.id === 'shape')!;
        shape.adjustment = -2;
        shape.states = [{ names: ['pressed'], value: 'shape.button' }];

        const result = assembleComposePreviewPayload(adjusted);

        expect(result).toMatchObject({
            ok: true,
            payload: {
                component: {
                    properties: {
                        shape: {
                            base: { type: 'tokenRef', tokenId: 'shape.button@adjust(-2)' },
                            states: [
                                { when: ['pressed'], source: { type: 'tokenRef', tokenId: 'shape.button@adjust(-2)' } },
                            ],
                        },
                    },
                },
                theme: {
                    'shape.button': { type: 'shape', cornerRadii: [12, 12, 12, 12] },
                    'shape.button@adjust(-2)': { type: 'shape', cornerRadii: [10, 10, 10, 10] },
                },
            },
        });
    });

    it('never lets an adjusted shape radius go below zero and keeps a zero adjustment plain', () => {
        const clamped = draft();
        clamped.invariantProperties.find((property) => property.id === 'shape')!.adjustment = -20;
        const clampedResult = assembleComposePreviewPayload(clamped);
        expect(clampedResult.ok && clampedResult.payload.theme['shape.button@adjust(-20)']).toEqual({
            type: 'shape',
            cornerRadii: [0, 0, 0, 0],
        });

        const plain = draft();
        plain.invariantProperties.find((property) => property.id === 'shape')!.adjustment = 0;
        const plainResult = assembleComposePreviewPayload(plain);
        expect(plainResult).toMatchObject({
            ok: true,
            payload: { component: { properties: { shape: { base: { type: 'tokenRef', tokenId: 'shape.button' } } } } },
        });
    });

    it('still reports an adjustment that cannot be applied to a token', () => {
        const color = draft();
        color.invariantProperties.find((property) => property.id === 'shape')!.type = 'color';
        color.invariantProperties.find((property) => property.id === 'shape')!.adjustment = -2;

        expect(assembleComposePreviewPayload(color)).toMatchObject({
            ok: false,
            diagnostics: [{ code: 'incompatible_value' }],
        });
    });

    it('reports the property IDs behind a real Compose parameter conflict', () => {
        const conflict = draft();
        conflict.invariantProperties.push({
            id: 'other-shape',
            name: 'shape',
            type: 'shape',
            composeParameters: ['shape'],
            value: 'shape.other',
            states: [],
        });

        expect(assembleComposePreviewPayload(conflict)).toMatchObject({
            ok: false,
            diagnostics: [
                {
                    code: 'property_conflict',
                    path: 'shape',
                    details: {
                        propertyName: 'shape',
                        sourcePropertyIds: ['shape', 'other-shape'],
                    },
                },
            ],
        });
    });

    it('keeps different component properties separate when they share a Compose platform parameter', () => {
        const result = assembleComposePreviewPayload(draft());

        expect(result).toMatchObject({
            ok: true,
            payload: {
                component: {
                    properties: {
                        paddingStart: { base: { type: 'tokenRef', tokenId: 'size.padding' } },
                        paddingEnd: { base: { type: 'tokenRef', tokenId: 'size.padding' } },
                    },
                },
            },
        });
    });

    describe('extended sources', () => {
        const prop = (overrides: Partial<PreviewPropertyDraft>): PreviewPropertyDraft => ({
            id: 'p',
            name: 'extra',
            type: 'color',
            composeParameters: ['extra'],
            states: [],
            ...overrides,
        });
        const assembled = (d: ComponentPreviewDraft) => {
            const result = assembleComposePreviewPayload(d);
            if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
            return result.payload;
        };

        it('does not emit extended fields for a minimal draft', () => {
            const payload = assembled(draft());
            expect(payload).not.toHaveProperty('styles');
            expect(JSON.stringify(payload)).not.toMatch(/alpha|styleRef|assetRef|gradient/);
            expect(payload.component.properties.backgroundColor.states).toEqual([
                { when: ['pressed'], source: { type: 'tokenRef', tokenId: 'color.pressed' } },
            ]);
        });

        it('keeps a combined state as one entry with a normalized name set', () => {
            const d = draft();
            d.invariantProperties.push(
                prop({
                    value: 'color.background',
                    states: [{ names: ['hover', 'selected'], value: 'color.pressed' }],
                }),
            );
            expect(assembled(d).component.properties.extra.states).toEqual([
                { when: ['hovered', 'selected'], source: { type: 'tokenRef', tokenId: 'color.pressed' } },
            ]);
        });

        it('applies alpha to base and state sources and rejects out-of-range alpha', () => {
            const d = draft();
            d.invariantProperties.push(
                prop({
                    value: 'color.background',
                    alpha: 0.4,
                    states: [{ names: ['pressed'], value: 'color.pressed', alpha: 0.5 }],
                }),
            );
            const value = assembled(d).component.properties.extra;
            expect(value.base).toEqual({ type: 'tokenRef', tokenId: 'color.background', alpha: 0.4 });
            expect(value.states?.[0].source).toEqual({ type: 'tokenRef', tokenId: 'color.pressed', alpha: 0.5 });

            const bad = draft();
            bad.invariantProperties.push(prop({ value: 'color.background', alpha: 1.5 }));
            expect(assembleComposePreviewPayload(bad)).toMatchObject({
                ok: false,
                diagnostics: [{ code: 'incompatible_value' }],
            });
        });

        it('collects transitively referenced styles and their theme tokens', () => {
            const d = draft();
            d.invariantProperties.push(prop({ name: 'dividerStyle', styleRef: 'divider' }));
            d.styles = [
                {
                    id: 'divider',
                    componentId: 'divider',
                    properties: [
                        prop({ name: 'color', value: 'color.pressed', styleRef: undefined }),
                        prop({ name: 'inner', styleRef: 'inner' }),
                    ],
                },
                { id: 'inner', componentId: 'divider', properties: [prop({ name: 'color', value: 'color.pressed' })] },
            ];
            const payload = assembled(d);
            expect(payload.component.properties.dividerStyle.base).toEqual({ type: 'styleRef', styleId: 'divider' });
            expect(Object.keys(payload.styles!).sort()).toEqual(['divider', 'inner']);
            expect(payload.styles!.divider.properties.color.base).toEqual({
                type: 'tokenRef',
                tokenId: 'color.pressed',
            });
        });

        it('rejects unknown style references and style cycles without a partial payload', () => {
            const unknown = draft();
            unknown.invariantProperties.push(prop({ name: 'dividerStyle', styleRef: 'missing' }));
            expect(assembleComposePreviewPayload(unknown)).toMatchObject({
                ok: false,
                diagnostics: [{ code: 'invalid_reference' }],
            });

            const cycle = draft();
            cycle.invariantProperties.push(prop({ name: 'dividerStyle', styleRef: 'a' }));
            cycle.styles = [
                { id: 'a', componentId: 'x', properties: [prop({ name: 'next', styleRef: 'b' })] },
                { id: 'b', componentId: 'x', properties: [prop({ name: 'next', styleRef: 'a' })] },
            ];
            expect(assembleComposePreviewPayload(cycle)).toMatchObject({ ok: false, diagnostics: [{ code: 'cycle' }] });
        });

        it('includes referenced assets and rejects a missing one', () => {
            const d = draft();
            d.assets = [...d.assets, { id: 'icon.close', type: 'SVG', url: 'https://example.test/close.svg' }];
            d.invariantProperties.push(prop({ name: 'icon', assetRef: 'icon.close' }));
            const payload = assembled(d);
            expect(payload.component.properties.icon.base).toEqual({ type: 'assetRef', assetId: 'icon.close' });
            expect(payload.assets.map((asset) => asset.id)).toContain('icon.close');

            const missing = draft();
            missing.invariantProperties.push(prop({ name: 'icon', assetRef: 'nope' }));
            expect(assembleComposePreviewPayload(missing)).toMatchObject({
                ok: false,
                diagnostics: [{ code: 'missing_asset' }],
            });
        });

        it('finds a token whose name differs from the reference only by separators', () => {
            const d = draft();
            d.themeTokens.push({
                id: 'surface.on-dark.solid-default',
                type: 'color',
                enabled: true,
                values: { web: '#112233', android: '#112233' },
            });
            d.invariantProperties.push(
                prop({ name: 'thumbColor', value: 'surface.on-dark.solid.default', type: 'color' }),
            );

            expect(assembled(d).theme['surface.on-dark.solid.default']).toEqual({ type: 'color', value: '#112233FF' });
        });

        it('does not guess when the separator-insensitive name matches several tokens', () => {
            const d = draft();
            d.themeTokens.push(
                { id: 'a.b-c', type: 'color', enabled: true, values: { web: '#112233', android: '#112233' } },
                { id: 'a-b.c', type: 'color', enabled: true, values: { web: '#445566', android: '#445566' } },
            );
            d.invariantProperties.push(prop({ name: 'thumbColor', value: 'a.b.c', type: 'color' }));

            expect(assembleComposePreviewPayload(d)).toMatchObject({
                ok: false,
                diagnostics: [{ code: 'missing_token' }],
            });
        });

        it('sends a value-typed property as a literal instead of a token reference', () => {
            const d = draft();
            d.invariantProperties.push(prop({ name: 'iconPlacement', value: 'start', type: 'value' }));

            const result = assembleComposePreviewPayload(d);

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.payload.component.properties.iconPlacement.base).toEqual({
                type: 'literal',
                value: 'start',
            });
        });

        it('normalizes gradient and shadow tokens', () => {
            const d = draft();
            d.invariantProperties.push(
                prop({ name: 'brush', value: 'gradient.main' }),
                prop({ name: 'elevation', value: 'shadow.s', type: 'shadow' }),
            );
            d.themeTokens.push(
                {
                    id: 'gradient.main',
                    type: 'gradient',
                    enabled: true,
                    values: { web: { kind: 'linear', colors: ['#FF0000', '#0000FFFF'], locations: [0, 1], angle: 90 } },
                },
                {
                    id: 'shadow.s',
                    type: 'shadow',
                    enabled: true,
                    values: { web: [{ offsetX: 0, offsetY: 2, blurRadius: 4, spreadRadius: -1, color: '#00000040' }] },
                },
            );
            const payload = assembled(d);
            expect(payload.theme['gradient.main']).toEqual({
                type: 'gradient',
                layers: [
                    {
                        kind: 'linear',
                        angle: 90,
                        stops: [
                            { color: '#FF0000FF', position: 0 },
                            { color: '#0000FFFF', position: 1 },
                        ],
                    },
                ],
            });
            expect(payload.theme['shadow.s']).toEqual({
                type: 'shadow',
                layers: [{ x: 0, y: 2, blur: 4, spread: -1, color: '#00000040' }],
            });
        });
        it('skips state entries without usable names and collapses aliases of one state', () => {
            const d = draft();
            d.invariantProperties.push(
                prop({
                    value: 'color.background',
                    states: [
                        { names: [], value: 'color.pressed' },
                        { names: [''], value: 'color.pressed' },
                        { names: ['hover', 'hovered'], value: 'color.pressed' },
                    ],
                }),
            );
            expect(assembled(d).component.properties.extra.states).toEqual([
                { when: ['hovered'], source: { type: 'tokenRef', tokenId: 'color.pressed' } },
            ]);
        });

        it('rejects alpha outside 0..1 on a state entry', () => {
            const d = draft();
            d.invariantProperties.push(
                prop({ value: 'color.background', states: [{ names: ['pressed'], value: 'color.pressed', alpha: 2 }] }),
            );
            expect(assembleComposePreviewPayload(d)).toMatchObject({
                ok: false,
                diagnostics: [{ code: 'incompatible_value' }],
            });
        });

        it('rejects a style that references itself', () => {
            const d = draft();
            d.invariantProperties.push(prop({ name: 'dividerStyle', styleRef: 'a' }));
            d.styles = [{ id: 'a', componentId: 'x', properties: [prop({ name: 'self', styleRef: 'a' })] }];
            expect(assembleComposePreviewPayload(d)).toMatchObject({ ok: false, diagnostics: [{ code: 'cycle' }] });
        });

        it('includes a style shared by two parents once and does not treat it as a cycle', () => {
            const d = draft();
            d.invariantProperties.push(prop({ name: 'first', styleRef: 'a' }), prop({ name: 'second', styleRef: 'b' }));
            d.styles = [
                { id: 'a', componentId: 'x', properties: [prop({ name: 'shared', styleRef: 'shared' })] },
                { id: 'b', componentId: 'x', properties: [prop({ name: 'shared', styleRef: 'shared' })] },
                { id: 'shared', componentId: 'x', properties: [prop({ name: 'color', value: 'color.pressed' })] },
            ];
            expect(Object.keys(assembled(d).styles!)).toEqual(['shared', 'a', 'b']);
        });

        it('reports an unknown style referenced from a nested style or from a state', () => {
            const nested = draft();
            nested.invariantProperties.push(prop({ name: 'outer', styleRef: 'a' }));
            nested.styles = [{ id: 'a', componentId: 'x', properties: [prop({ name: 'inner', styleRef: 'missing' })] }];
            expect(assembleComposePreviewPayload(nested)).toMatchObject({
                ok: false,
                diagnostics: [{ code: 'invalid_reference' }],
            });
        });

        it('adds theme tokens that are used only by a nested style', () => {
            const d = draft();
            d.themeTokens.push({ id: 'color.nested.only', type: 'color', enabled: true, values: { web: '#010203' } });
            d.invariantProperties.push(prop({ name: 'dividerStyle', styleRef: 'a' }));
            d.styles = [
                { id: 'a', componentId: 'x', properties: [prop({ name: 'color', value: 'color.nested.only' })] },
            ];
            expect(assembled(d).theme['color.nested.only']).toEqual({ type: 'color', value: '#010203FF' });
        });

        it('passes a solid platform value of a gradient family as a single-colour linear layer', () => {
            for (const value of ['#112233', ['#112233'], [{ kind: 'color', background: '#112233' }]]) {
                const d = draft();
                d.invariantProperties.push(prop({ name: 'brush', value: 'gradient.solid' }));
                d.themeTokens.push({ id: 'gradient.solid', type: 'gradient', enabled: true, values: { web: value } });
                expect(assembled(d).theme['gradient.solid']).toEqual({
                    type: 'gradient',
                    layers: [
                        {
                            kind: 'linear',
                            angle: 0,
                            stops: [
                                { color: '#112233FF', position: 0 },
                                { color: '#112233FF', position: 1 },
                            ],
                        },
                    ],
                });
            }
        });

        it.each([
            ['radial gradient', { kind: 'radial', colors: ['#FFFFFF', '#000000'], locations: [0, 1] }],
            ['single stop', { kind: 'linear', colors: ['#FFFFFF'], locations: [0], angle: 0 }],
            ['location out of range', { kind: 'linear', colors: ['#FFFFFF', '#000000'], locations: [0, 2], angle: 0 }],
            ['mismatched lengths', { kind: 'linear', colors: ['#FFFFFF', '#000000'], locations: [0], angle: 0 }],
            ['invalid colour', { kind: 'linear', colors: ['#FFFFFF', 'red'], locations: [0, 1], angle: 0 }],
            ['invalid solid layer', { kind: 'color', background: '[general.red.500]' }],
        ])('rejects an unsupported gradient token: %s', (_name, layer) => {
            const d = draft();
            d.invariantProperties.push(prop({ name: 'brush', value: 'gradient.bad' }));
            d.themeTokens.push({ id: 'gradient.bad', type: 'gradient', enabled: true, values: { web: [layer] } });
            expect(assembleComposePreviewPayload(d)).toMatchObject({
                ok: false,
                diagnostics: [{ code: 'incompatible_value' }],
            });
        });

        it('rejects a shadow with an invalid colour or no layers', () => {
            for (const value of [[], [{ offsetX: 0, offsetY: 0, blurRadius: 1, spreadRadius: 0, color: 'nope' }]]) {
                const d = draft();
                d.invariantProperties.push(prop({ name: 'elevation', value: 'shadow.bad', type: 'shadow' }));
                d.themeTokens.push({ id: 'shadow.bad', type: 'shadow', enabled: true, values: { web: value } });
                expect(assembleComposePreviewPayload(d)).toMatchObject({
                    ok: false,
                    diagnostics: [{ code: 'incompatible_value' }],
                });
            }
        });
    });
});
