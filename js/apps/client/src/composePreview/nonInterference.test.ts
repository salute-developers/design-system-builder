import { describe, expect, it } from 'vitest';

import { assembleComposePreviewPayload } from './assembler';
import { createComponentPreviewDraft } from './draft';
import { createControllerFixtures } from './testControllerDraftFixture';

const snapshot = (fixtures: ReturnType<typeof createControllerFixtures>) =>
    JSON.stringify({
        configRevision: fixtures.config.getRevision(),
        themeRevision: fixtures.theme.getRevision(),
        invariants: fixtures.config
            .getInvariants()
            .getList()
            .map((prop) => [prop.getID(), prop.getValue(), prop.getStates()]),
        variations: fixtures.config.getVariations().map((variation) => [
            variation.getID(),
            variation.getStyles()?.map((style) => [
                style.getID(),
                style
                    .getProps()
                    .getList()
                    .map((prop) => [prop.getID(), prop.getValue()]),
            ]),
        ]),
        colors: fixtures.theme.getTokens('color').map((token) => [token.getName(), token.getValue('web')]),
    });

// Сборка payload для Compose только читает модель: настройки токенов, тем и свойств остаются прежними,
// поэтому React-preview и CSS-переменные не зависят от Compose-preview.
describe('Compose preview does not mutate the editor model', () => {
    it('leaves Config and Theme unchanged when the draft and payload are assembled', () => {
        const fixtures = createControllerFixtures();
        const before = snapshot(fixtures);

        const draft = createComponentPreviewDraft({
            config: fixtures.config,
            theme: fixtures.theme,
            args: { density: 'compact', text: 'Text', loading: false },
            themeMode: 'light',
            themeValuePlatform: 'web',
            surface: { width: 360, height: 160, background: '#FFFFFFFF' },
        });
        expect(draft.ok).toBe(true);
        if (draft.ok) assembleComposePreviewPayload(draft.draft);

        expect(snapshot(fixtures)).toBe(before);
    });
});
