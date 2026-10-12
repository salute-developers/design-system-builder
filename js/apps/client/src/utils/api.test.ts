import { describe, expect, it } from 'vitest';

import type { Meta } from '../controllers';
import { addLegacyPreviewBindings } from './api';

const meta = (name: string, preview?: Meta['preview']): Meta => ({
    name,
    description: name,
    preview,
    sources: {
        api: [],
        variations: [],
        configs: [],
    },
});

describe('addLegacyPreviewBindings', () => {
    it('adds only the pilot Button binding', () => {
        const [button, checkbox] = addLegacyPreviewBindings([meta('Button'), meta('Checkbox')]);

        expect(button.preview?.compose).toEqual({
            componentId: 'BasicButton',
            storyId: 'BasicButton',
        });
        expect(checkbox.preview).toBeUndefined();
    });

    it('preserves metadata supplied by the producer', () => {
        const custom = {
            compose: {
                componentId: 'custom.button',
                storyId: 'CustomButtonStory',
            },
        };

        expect(addLegacyPreviewBindings([meta('Button', custom)])[0].preview).toEqual(custom);
    });
});
