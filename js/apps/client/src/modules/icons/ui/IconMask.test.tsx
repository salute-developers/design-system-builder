import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { IconMask } from './IconMask';

describe('IconMask', () => {
    afterEach(cleanup);

    it('draws a mask from the SVG url', () => {
        render(<IconMask url="https://x.test/24/AddOutline.svg" size={24} />);
        expect(screen.getByTestId('icon-mask')).toBeInTheDocument();
    });

    it('falls back to a placeholder when the file fails to load', async () => {
        const created: Array<{ onerror: (() => void) | null }> = [];
        const Original = globalThis.Image;
        globalThis.Image = class {
            onerror: (() => void) | null = null;
            set src(_value: string) {
                created.push(this);
            }
        } as unknown as typeof Image;
        try {
            render(<IconMask url="https://x.test/broken.svg" size={24} />);
            created[0].onerror?.();
            await waitFor(() => expect(screen.getByTestId('icon-placeholder')).toBeInTheDocument());
        } finally {
            globalThis.Image = Original;
        }
    });
});
