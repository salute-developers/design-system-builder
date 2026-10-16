import { describe, expect, it } from 'vitest';

import { createControllerFixtures } from '../../composePreview/testControllerDraftFixture';

// Revision служит ключом пересборки payload: каждая мутация модели обязана его менять.
describe('Config revision', () => {
    it('increases on every mutation that can change the preview', () => {
        const { meta, config } = createControllerFixtures();
        const api = meta.sources.api;
        const revisions = [config.getRevision()];
        const next = () => revisions.push(config.getRevision());

        config.updateToken('background', 'color.other');
        next();
        config.addToken('height', 48, api, 'axis-density', 'compact');
        next();
        config.removeToken('height', 'axis-density', 'compact');
        next();
        config.removeToken('background');
        next();
        config.addVariationStyle(api, 'axis-density', 'Wide');
        next();
        const addedStyleId = config.getVariations()[0].getStyles()?.find((style) => style.getName() === 'Wide')?.getID();
        config.removeVariationStyle('axis-density', addedStyleId);
        next();

        expect(revisions.every((revision, index) => index === 0 || revision > revisions[index - 1])).toBe(true);
    });

    it('stays the same for a no-op removal', () => {
        const { config } = createControllerFixtures();
        const before = config.getRevision();

        config.removeVariationStyle(undefined, undefined);

        expect(config.getRevision()).toBe(before);
    });
});
