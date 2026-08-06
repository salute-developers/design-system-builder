import { describe, expect, it } from 'vitest';

import { assembleComposePreviewPayload } from './assembler';
import type { ComponentPreviewDraft } from './draft';
import { createPreviewDraftFixture } from './testDraftFixture';

const draft = (): ComponentPreviewDraft => createPreviewDraftFixture();

describe('assembleComposePreviewPayload', () => {
    it('assembles deterministic properties, states, theme closure and font assets', () => {
        const result = assembleComposePreviewPayload(draft());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.component.variations).toEqual({ customAxis: 'rounded' });
        expect(result.payload.component.properties.backgroundColor.states?.pressed).toEqual({
            type: 'tokenRef',
            tokenId: 'color.pressed',
        });
        expect(result.payload.component.properties.disabledAlpha.base).toEqual({ type: 'literal', value: 0.4 });
        expect(result.payload.theme['color.background']).toEqual({ type: 'color', value: '#123456FF' });
        expect(result.payload.theme['typography.button']).toMatchObject({
            type: 'typography',
            fontFamilyTokenId: 'font.body',
        });
        expect(result.payload.theme['font.body']).toMatchObject({ type: 'fontFamily' });
        expect(result.payload.assets).toHaveLength(1);
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
        composed.selectedStyleProperties.push(
            { ...shape, value: 'shape.size' },
            { ...shape, value: 'shape.pilled' },
        );
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
});
