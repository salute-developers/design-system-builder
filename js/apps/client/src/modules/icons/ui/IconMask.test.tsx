import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useFailedIconUrls } from '../application/iconLoadFailures';
import { IconMask } from './IconMask';

interface FakeImage {
    url: string;
    onerror: (() => void) | null;
    onload: (() => void) | null;
}

/** В jsdom `Image` ничего не загружает: подменяем его и вызываем `onerror`/`onload` вручную, как браузер. */
const installFakeImage = () => {
    const created: FakeImage[] = [];
    const Original = globalThis.Image;
    globalThis.Image = class {
        url = '';
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;
        set src(value: string) {
            this.url = value;
            created.push(this);
        }
    } as unknown as typeof Image;
    const fire = (event: 'onerror' | 'onload', match: (url: string) => boolean) =>
        act(() => created.filter((image) => match(image.url)).forEach((image) => image[event]?.()));
    return {
        created,
        restore: () => {
            fire('onload', () => true);
            globalThis.Image = Original;
        },
        fail: (match: (url: string) => boolean) => fire('onerror', match),
        load: (match: (url: string) => boolean) => fire('onload', match),
    };
};

describe('IconMask', () => {
    let fake: ReturnType<typeof installFakeImage>;

    beforeEach(() => {
        fake = installFakeImage();
    });

    afterEach(() => {
        fake.restore();
        cleanup();
    });

    it('draws a mask from the SVG url', () => {
        render(<IconMask url="https://x.test/24/AddOutline.svg" size={24} />);
        expect(screen.getByTestId('icon-mask')).toBeInTheDocument();
    });

    it('falls back to a named placeholder when the file fails to load', async () => {
        render(<IconMask url="https://x.test/broken.svg" size={24} />);
        fake.fail(() => true);

        const placeholder = await screen.findByTestId('icon-placeholder');
        expect(placeholder).toHaveAttribute('role', 'img');
        expect(placeholder).toHaveAttribute('aria-label', 'Не удалось загрузить иконку');
    });

    it('marks the url as failed on error and clears the mark after a successful load', async () => {
        const url = 'https://x.test/24/Flaky.svg';
        const failed = renderHook(() => useFailedIconUrls().has(url));
        const { rerender } = render(<IconMask url={url} size={24} />);

        fake.fail((image) => image === url);
        await waitFor(() => expect(failed.result.current).toBe(true));

        rerender(<IconMask url="https://x.test/24/Other.svg" size={24} />);
        rerender(<IconMask url={url} size={24} />);
        fake.load((image) => image === url);

        await waitFor(() => expect(failed.result.current).toBe(false));
        expect(screen.getByTestId('icon-mask')).toBeInTheDocument();
    });

    it('does not affect other masks when one file fails', async () => {
        render(
            <>
                <IconMask url="https://x.test/24/Broken.svg" size={24} />
                <IconMask url="https://x.test/24/Fine.svg" size={24} />
            </>,
        );

        fake.fail((image) => image.endsWith('Broken.svg'));

        await screen.findByTestId('icon-placeholder');
        expect(screen.getAllByTestId('icon-mask')).toHaveLength(1);
        expect(screen.getAllByTestId('icon-placeholder')).toHaveLength(1);
    });
});
