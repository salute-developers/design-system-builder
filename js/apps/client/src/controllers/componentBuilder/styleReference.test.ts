import { describe, expect, it } from 'vitest';

import { buttonMeta, groupMeta } from '../../composePreview/nestedStyleFixture';
import { resolveStyleReference } from './styleReference';

describe('resolveStyleReference', () => {
    const components = [groupMeta(), buttonMeta()];

    it('selects the styles named by the reference in the target configuration', () => {
        const resolved = resolveStyleReference(components, 'basic-button.xxs.default');

        expect(resolved?.config.getName()).toBe('BasicButton');
        expect(resolved?.selections).toEqual({ size: 'size-xxs', view: 'view-default' });
    });

    it('falls back to the default style of a variation the reference does not name', () => {
        const resolved = resolveStyleReference(components, 'basic-button.xxs');

        expect(resolved?.selections).toEqual({ size: 'size-xxs', view: 'view-default' });
    });

    it('finds a style name that is not in its positional variation', () => {
        const resolved = resolveStyleReference(components, 'basic-button.default.xxs');

        expect(resolved?.selections).toEqual({ size: 'size-xxs', view: 'view-default' });
    });

    it('returns nothing for a configuration that does not exist', () => {
        expect(resolveStyleReference(components, 'missing.xxs')).toBeUndefined();
    });
});
