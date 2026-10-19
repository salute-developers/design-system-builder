import { describe, expect, it } from 'vitest';

import { Config } from '../controllers/componentBuilder';
import type { Meta } from '../controllers/componentBuilder/type';
import { buildMockTheme } from '../controllers/themeBuilder/themes/builders';
import { assembleComposePreviewPayload } from './assembler';
import { createComponentPreviewDraft } from './draft';

const meta = (): Meta => ({
    name: 'Button',
    description: 'Button',
    preview: { compose: { componentId: 'BasicButton', storyId: 'BasicButton' } },
    sources: {
        variations: [],
        api: [
            {
                id: 'background',
                name: 'background',
                type: 'color',
                variations: null,
                platformMappings: { compose: 'backgroundColor', web: [], xml: null, ios: null },
            },
        ],
        configs: [
            {
                id: 'default',
                name: 'default',
                config: {
                    defaultVariations: [],
                    variations: [],
                    // Порядок конфигурации (как в Android ColorStateList): первое совпадение побеждает.
                    invariantProps: [
                        {
                            id: 'background',
                            value: 'color.background',
                            states: [
                                { state: ['pressed'], value: 'color.background' },
                                { state: ['hovered'], value: 'color.background' },
                            ],
                        },
                    ],
                },
            },
        ],
    },
});

describe('state order of a property', () => {
    it('puts the state that wins in Android last, because the protocol lets the last equal entry win', () => {
        const theme = buildMockTheme();
        const [token] = theme.getTokens('color');
        token.setName('light.color.background');
        token.setValue('web', '#246BCE');
        const draft = createComponentPreviewDraft({
            config: new Config(meta()),
            theme,
            args: {},
            themeMode: 'light',
            themeValuePlatform: 'web',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });
        if (!draft.ok) throw new Error(`draft failed: ${JSON.stringify(draft.diagnostics)}`);

        const result = assembleComposePreviewPayload(draft.draft);

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.payload.component.properties.background.states?.map((entry) => entry.when)).toEqual([
            ['hovered'],
            ['pressed'],
        ]);
    });
});
