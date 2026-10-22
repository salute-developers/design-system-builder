import { describe, expect, it } from 'vitest';

import { getEditorClientId } from './editorClientIdentity';

describe('editor client identity', () => {
    it('does not reuse a session storage value copied from another tab', () => {
        sessionStorage.setItem('ds-editor-client-id', 'copied-client');

        const first = getEditorClientId();

        expect(first).not.toBe('copied-client');
        expect(getEditorClientId()).toBe(first);
    });
});
