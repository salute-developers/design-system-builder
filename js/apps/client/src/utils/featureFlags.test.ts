import { afterEach, describe, expect, it, vi } from 'vitest';

import { isComponentEditorEnabled } from './featureFlags';

describe('isComponentEditorEnabled', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it.each([
        ['true', true],
        ['false', false],
        ['', false],
        ['TRUE', false],
        ['1', false],
        ['yes', false],
    ])('treats the value "%s" as %s', (value, expected) => {
        vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', value);

        expect(isComponentEditorEnabled()).toBe(expected);
    });

    it('follows the dev server when the variable is not set', () => {
        vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', undefined as unknown as string);

        vi.stubEnv('DEV', true as unknown as string);
        expect(isComponentEditorEnabled()).toBe(true);

        vi.stubEnv('DEV', false as unknown as string);
        expect(isComponentEditorEnabled()).toBe(false);
    });

    it('lets an explicit value win over the dev server default', () => {
        vi.stubEnv('DEV', true as unknown as string);
        vi.stubEnv('VITE_COMPONENT_EDITOR_ENABLED', 'false');

        expect(isComponentEditorEnabled()).toBe(false);
    });
});
