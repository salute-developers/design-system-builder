import { describe, expect, it } from 'vitest';

import type { Meta } from '../controllers';
import { markComposeComponents, parseComponentRoute, toComponentRoute } from './composeComponents';

const meta = (name: string, preview?: Meta['preview']): Meta => ({
    name,
    description: name,
    preview,
    sources: { api: [], variations: [], configs: [] },
});

describe('markComposeComponents', () => {
    it('derives the plugin binding from the component name', () => {
        const [button] = markComposeComponents([meta('BasicButton')]);

        expect(button.platform).toBe('compose');
        expect(button.preview?.compose).toEqual({ componentId: 'BasicButton', storyId: 'BasicButton' });
    });

    it('keeps a binding supplied by the producer', () => {
        const custom = { compose: { componentId: 'custom', storyId: 'CustomStory' } };

        expect(markComposeComponents([meta('Avatar', custom)])[0].preview).toEqual(custom);
    });
});

describe('component route', () => {
    it('keeps web and compose components with the same name apart', () => {
        expect(toComponentRoute('web', 'Avatar')).toBe('Avatar');
        expect(toComponentRoute('compose', 'Avatar')).toBe('compose-Avatar');
    });

    it('parses a route back to platform and name', () => {
        expect(parseComponentRoute('Avatar')).toEqual({ platform: 'web', name: 'Avatar' });
        expect(parseComponentRoute('compose-Avatar')).toEqual({ platform: 'compose', name: 'Avatar' });
    });
});
