import { describe, expect, it } from 'vitest';

import type { Config } from '../controllers';
import { caseArgs, loadWebBaseFixture } from './__fixtures__/webBaseSnapshot';
import { assembleComposePreviewPayload } from './assembler';
import { createComponentPreviewDraft } from './draft';
import type { PreviewPayloadInput } from './types';
import { DEFAULT_WEB_STORY_ID, assembleWebPreviewPayload } from './webPreview';

const fixture = loadWebBaseFixture();

const assemble = (component: string, selections: Record<string, string> = {}, mode = 'dark'): PreviewPayloadInput => {
    const config = fixture.config(component);
    const result = assembleWebPreviewPayload({
        config,
        theme: fixture.theme,
        args: caseArgs(config, selections),
        themeMode: mode,
        storyId: DEFAULT_WEB_STORY_ID,
        storyProps: {},
        backgroundToken: `${mode}.background.default.primary`,
        designSystem: fixture.designSystem,
        relatedConfigs: new Map<string, Config>(),
    });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    return result.payload;
};

const stylesOf = (payload: PreviewPayloadInput, component: string) =>
    Object.entries(payload.styles ?? {}).filter(([, style]) => style.component === component);

describe('assembler for the WEB platform', () => {
    it('emits properties by canonical name with tokenRef, literal and states, without CSS', () => {
        const payload = assemble('Button', { view: 'accent', size: 'l' });

        expect(payload.platform).toBe('WEB');
        expect(payload).not.toHaveProperty('web');
        expect(payload.component.variations).toEqual({ view: 'accent', size: 'l', shape: 'rounded' });
        expect(payload.component.properties.backgroundColor).toEqual({
            base: { type: 'tokenRef', tokenId: 'surface.default.accent' },
            states: [
                { when: ['hovered'], source: { type: 'tokenRef', tokenId: 'surface.default.accent-hover' } },
                { when: ['pressed'], source: { type: 'tokenRef', tokenId: 'surface.default.accent-active' } },
            ],
        });
        expect(payload.component.properties.height).toEqual({ base: { type: 'literal', value: 56 } });
        expect(JSON.stringify(payload.component.properties)).not.toMatch(/rem|var\(--|Hover"|Active"/);
    });

    it('puts web theme values into protocol units', () => {
        const payload = assemble('Button', { size: 'l' });

        expect(payload.theme['surface.default.solid-default']).toMatchObject({ type: 'color' });
        expect((payload.theme['surface.default.solid-default'] as { value: string }).value).toMatch(/^#[0-9A-F]{8}$/);
        expect(payload.theme['body.l.bold']).toEqual({
            type: 'typography',
            fontFamilyTokenId: 'fontFamily.body',
            fontSize: 18,
            lineHeight: 22,
            letterSpacing: -0.36,
            weight: 600,
            fontStyle: 'NORMAL',
        });
        // Поправка формы (`round.l`, -2 px) — производный токен с уменьшенными радиусами.
        expect(payload.theme['round.l@adjust(-2)']).toEqual({ type: 'shape', cornerRadii: [14, 14, 14, 14] });
        expect(payload.assets.every((asset) => asset.type === 'WOFF2')).toBe(true);
    });

    it('adds every typography token of the screen: property values reference their CSS variables', () => {
        const payload = assemble('Button');

        for (const id of ['text.m.bold', 'text.m.medium', 'text.m.normal', 'header.h1.bold', 'body.l.normal']) {
            expect(payload.theme[id], id).toMatchObject({ type: 'typography' });
        }
        expect(Object.keys(payload.theme).some((id) => id.startsWith('screen-'))).toBe(false);
    });

    it('adds the story environment: mode colors, body font and the surface token', () => {
        const payload = assemble('Chip', {}, 'light');

        expect(payload.surface.background).toBe('light.background.default.primary');
        expect(payload.theme['light.background.default.primary']).toMatchObject({ type: 'color' });
        expect(payload.theme['light.text.default.primary']).toMatchObject({ type: 'color' });
        expect(payload.theme['fontFamily.body']).toMatchObject({ type: 'fontFamily', allowFallback: true });
        expect(Object.keys(payload.theme).some((id) => id.startsWith('dark.'))).toBe(false);
    });

    it('sends the web value override as tokenRef of the state (Chip accent color)', () => {
        const payload = assemble('Chip', { view: 'accent' });

        expect(payload.component.properties.color).toEqual({
            base: { type: 'tokenRef', tokenId: 'text.on-dark.primary' },
            states: [
                { when: ['pressed'], source: { type: 'tokenRef', tokenId: 'text.on-dark.primary' } },
                { when: ['hovered'], source: { type: 'tokenRef', tokenId: 'text.on-dark.primary' } },
            ],
        });
        expect(payload.theme['text.on-dark.primary']).toMatchObject({ type: 'color' });
    });

    it('sends every style and the invariants of the dependencies (ButtonGroup → Button) with their tokens', () => {
        const payload = assemble('ButtonGroup', { view: 'accent' });
        const button = fixture.config('Button');
        const buttonStyles = stylesOf(payload, 'Button');

        const expected = button
            .getVariations()
            .flatMap((variation) =>
                (variation.getStyles() ?? []).map((style) => `Button/${variation.getName()}/${style.getName()}`),
            );
        expect(buttonStyles.map(([id]) => id).sort()).toEqual([...expected, 'Button/invariants'].sort());
        expect(payload.styles?.['Button/view/default']).toMatchObject({
            component: 'Button',
            variation: 'view',
            name: 'default',
            default: true,
        });
        expect(payload.styles?.['Button/view/secondary']).not.toHaveProperty('default');
        expect(payload.styles?.['Button/invariants']).toMatchObject({ component: 'Button', invariant: true });
        for (const [, style] of buttonStyles) {
            for (const value of Object.values(style.properties)) {
                for (const source of [value.base, ...(value.states ?? []).map((state) => state.source)]) {
                    if (source.type === 'tokenRef') expect(payload.theme[source.tokenId]).toBeDefined();
                }
            }
        }
    });

    it('sends the compose parent of a child component (TabItem → Tabs) and the children of a parent', () => {
        expect(stylesOf(assemble('TabItem'), 'Tabs').length).toBeGreaterThan(0);
        const tabs = assemble('Tabs');
        expect(stylesOf(tabs, 'TabItem').length).toBeGreaterThan(0);
        expect(stylesOf(tabs, 'IconTabItem').length).toBeGreaterThan(0);
    });

    it('selects properties by web parameters: no web parameter but others — skipped, none at all — missing_mapping', () => {
        const config = fixture.config('Button');
        const draft = createComponentPreviewDraft({
            config,
            theme: fixture.theme,
            rendererPlatform: 'WEB',
            previewMetadata: { componentId: 'Button', storyId: 'Default' },
            args: caseArgs(config, {}),
            themeMode: 'dark',
            themeValuePlatform: 'web',
            surface: { width: 1, height: 1, background: 'dark.background.default.primary' },
        });
        if (!draft.ok) throw new Error('draft');
        const base = draft.draft;
        const prop = { id: 'p', name: 'composeOnly', type: 'dimension' as const, value: 4, states: [] };

        const skipped = assembleComposePreviewPayload({
            ...base,
            invariantProperties: [
                ...base.invariantProperties,
                { ...prop, composeParameters: ['padding'], webParameters: [], hasNonWebMappings: true },
            ],
        });
        expect(skipped.ok && skipped.payload.component.properties.composeOnly).toBeFalsy();

        expect(
            assembleComposePreviewPayload({
                ...base,
                invariantProperties: [
                    ...base.invariantProperties,
                    { ...prop, composeParameters: [], webParameters: [] },
                ],
            }),
        ).toMatchObject({ ok: false, diagnostics: [{ code: 'missing_mapping' }] });
    });
});
