import { describe, expect, it } from 'vitest';

import { Config } from '../controllers/componentBuilder';
import type { Meta } from '../controllers/componentBuilder/type';
import { buildMockTheme } from '../controllers/themeBuilder/themes/builders';
import { assembleComposePreviewPayload } from './assembler';
import { createComponentPreviewDraft } from './draft';
import type { HostDefaults } from './draft';

const colorApi = (name: string) => ({
    id: name,
    name,
    type: 'color' as const,
    variations: null,
    platformMappings: { compose: name, web: [], xml: null, ios: null },
});

const meta = (name: string, value: string): Meta => ({
    name,
    description: name,
    preview: { compose: { componentId: name, storyId: name } },
    sources: {
        variations: [],
        api: [colorApi('background')],
        configs: [
            {
                id: 'default',
                name: 'default',
                config: {
                    defaultVariations: [],
                    variations: [],
                    invariantProps: [{ id: 'background', value }],
                },
            },
        ],
    },
});

const assemble = (hostDefaults: HostDefaults, buttonToken = 'color.background') => {
    const theme = buildMockTheme();
    const [token] = theme.getTokens('color');
    token.setName('light.color.background');
    token.setValue('web', '#246BCE');
    const button = new Config(meta('BasicButton', buttonToken));
    const draft = createComponentPreviewDraft({
        config: new Config(meta('Avatar', 'color.background')),
        theme,
        args: {},
        resolveStyleReference: (reference) =>
            reference === 'basic-button.m.default' ? { config: button, selections: {} } : undefined,
        hostDefaults,
        themeMode: 'light',
        themeValuePlatform: 'web',
        surface: { width: 360, height: 160, background: '#FFFFFFFF' },
    });
    if (!draft.ok) throw new Error(`draft failed: ${JSON.stringify(draft.diagnostics)}`);
    return assembleComposePreviewPayload(draft.draft);
};

describe('host defaults of the preview', () => {
    it('adds the default button style as a nested style and the default text color from the theme', () => {
        const result = assemble({
            text: { color: 'color.background' },
            styles: { button: 'basic-button.m.default' },
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.defaults).toEqual({
            text: { color: 'color.background' },
            styles: { button: 'basic-button.m.default' },
        });
        expect(result.payload.styles?.['basic-button.m.default']).toMatchObject({ component: 'BasicButton' });
        expect(Object.keys(result.payload.theme)).toContain('color.background');
    });

    it('leaves out a default style that cannot be resolved and a text token the theme does not have', () => {
        const result = assemble({
            text: { style: 'body.m.normal', color: 'text.default.primary' },
            styles: { button: 'basic-button.m.default', spinner: 'spinner.xs.default' },
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.defaults).toEqual({ styles: { button: 'basic-button.m.default' } });
    });

    it('does not break the preview when a default style uses a token the theme does not have', () => {
        const result = assemble({ styles: { button: 'basic-button.m.default' } }, 'color.missing');

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload).not.toHaveProperty('defaults');
        expect(result.payload.styles).toBeUndefined();
    });

    it('adds nothing without host defaults', () => {
        const theme = buildMockTheme();
        const [token] = theme.getTokens('color');
        token.setName('light.color.background');
        token.setValue('web', '#246BCE');
        const draft = createComponentPreviewDraft({
            config: new Config(meta('Avatar', 'color.background')),
            theme,
            args: {},
            themeMode: 'light',
            themeValuePlatform: 'web',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });
        if (!draft.ok) throw new Error('draft failed');

        const result = assembleComposePreviewPayload(draft.draft);

        expect(result.ok && result.payload).not.toHaveProperty('defaults');
    });
});
