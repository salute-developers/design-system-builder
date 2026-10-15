import { describe, expect, it } from 'vitest';

import { Config } from '../controllers/componentBuilder';
import type { Meta } from '../controllers/componentBuilder/type';
import { buildMockTheme } from '../controllers/themeBuilder/themes/builders';
import { assembleComposePreviewPayload } from './assembler';
import { createControllerDraftFixture } from './testControllerDraftFixture';
import { createComponentPreviewDraft } from './draft';

const accordionItemMeta = (invariantProps: Array<{ id: string; value: string }>): Meta => ({
    name: 'AccordionItem',
    description: 'AccordionItem',
    preview: { compose: { componentId: 'AccordionItem', storyId: 'AccordionItem' } },
    sources: {
        variations: [{ id: 'axis-size', name: 'size' }],
        api: [
            {
                id: 'closed-icon',
                name: 'closedIcon',
                type: 'icon',
                variations: null,
                platformMappings: { compose: 'closedIcon', web: [], xml: null, ios: null },
            },
            {
                id: 'opened-icon',
                name: 'openedIcon',
                type: 'icon',
                variations: null,
                platformMappings: { compose: 'openedIcon', web: [], xml: null, ios: null },
            },
            {
                id: 'icon-rotation',
                name: 'iconRotation',
                type: 'float',
                variations: null,
                platformMappings: { compose: 'iconRotation', web: [], xml: null, ios: null },
            },
        ],
        configs: [
            {
                id: 'AccordionItem',
                name: 'default',
                config: {
                    defaultVariations: [{ variationID: 'axis-size', styleID: 'xs' }],
                    invariantProps: [...invariantProps, { id: 'icon-rotation', value: '180' }],
                    variations: [{ id: 'axis-size', styles: [{ id: 'xs', name: 'xs', intersections: null, props: [] }] }],
                },
            },
        ],
    },
});

const assemble = (invariantProps: Array<{ id: string; value: string }>) => {
    const config = new Config(accordionItemMeta(invariantProps));
    const draft = createComponentPreviewDraft({
        config,
        theme: buildMockTheme(),
        args: {},
        themeMode: 'light',
        themeValuePlatform: 'android',
        surface: { width: 360, height: 160, background: '#FFFFFFFF' },
    });
    if (!draft.ok) throw new Error(`draft failed: ${JSON.stringify(draft.diagnostics)}`);
    return { config, result: assembleComposePreviewPayload(draft.draft) };
};

describe('icon properties of a Compose component', () => {
    it('keeps icons in the configuration model', () => {
        const { config } = assemble([
            { id: 'closed-icon', value: 'disclosure.down.fill.16' },
            { id: 'opened-icon', value: 'disclosure.up.fill.16' },
        ]);

        const icons = config
            .getInvariants()
            .getList()
            .filter((prop) => prop.getType() === 'icon')
            .map((prop) => [prop.getName(), prop.getValue()]);

        expect(icons).toEqual([
            ['closedIcon', 'disclosure.down.fill.16'],
            ['openedIcon', 'disclosure.up.fill.16'],
        ]);
    });

    it('sends the icon name as a literal, not as a token reference', () => {
        const { result } = assemble([
            { id: 'closed-icon', value: 'disclosure.down.fill.16' },
            { id: 'opened-icon', value: 'disclosure.up.fill.16' },
        ]);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.component.properties.closedIcon).toEqual({
            base: { type: 'literal', value: 'disclosure.down.fill.16' },
        });
        expect(result.payload.component.properties.openedIcon).toEqual({
            base: { type: 'literal', value: 'disclosure.up.fill.16' },
        });
        // Имя иконки не должно попасть в замыкание токенов темы.
        expect(Object.keys(result.payload.theme)).not.toContain('disclosure.down.fill.16');
    });

    it('omits an icon without a value and still assembles the rest', () => {
        const { result } = assemble([
            { id: 'closed-icon', value: '' },
            { id: 'opened-icon', value: 'disclosure.up.fill.16' },
        ]);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.component.properties).not.toHaveProperty('closedIcon');
        expect(result.payload.component.properties.openedIcon).toEqual({
            base: { type: 'literal', value: 'disclosure.up.fill.16' },
        });
        expect(result.payload.component.properties.iconRotation).toEqual({ base: { type: 'literal', value: 180 } });
    });

    it('keeps icons of a nested style and skips the empty ones', () => {
        const fixture = createControllerDraftFixture();
        if (!fixture.ok) throw new Error('draft failed');
        const draft = fixture.draft;
        const icon = (id: string, name: string, value?: string) => ({
            id,
            name,
            type: 'icon' as const,
            composeParameters: [name],
            value,
            states: [],
        });
        const result = assembleComposePreviewPayload({
            ...draft,
            selectedStyleProperties: [
                ...draft.selectedStyleProperties,
                {
                    id: 'nested-ref',
                    name: 'itemStyle',
                    type: 'component_style',
                    composeParameters: ['itemStyle'],
                    styleRef: 'item.default',
                    states: [],
                },
            ],
            styles: [
                {
                    id: 'item.default',
                    componentId: 'AccordionItem',
                    properties: [
                        icon('nested-closed', 'closedIcon', 'disclosure.down.fill.16'),
                        icon('nested-opened', 'openedIcon', ''),
                    ],
                },
            ],
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.styles?.['item.default'].properties).toEqual({
            closedIcon: { base: { type: 'literal', value: 'disclosure.down.fill.16' } },
        });
    });
});
