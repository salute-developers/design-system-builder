import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComposePreviewFrame } from './ComposePreviewFrame';
import { loadedManifest } from './testFixture';
import { PreviewPayload, PreviewResult } from './types';

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

describe('ComposePreviewFrame', () => {
    it('keeps one iframe and ignores stale status while sending a new full payload', async () => {
        const first = deferred<PreviewResult>();
        const second = deferred<PreviewResult>();
        const results = [first, second];
        let request = 0;
        const send = vi.fn((payload: PreviewPayload) => {
            void payload;
            return {
                requestId: `request-${++request}`,
                result: results[request - 1].promise,
            };
        });
        const session = {
            waitUntilReady: vi.fn().mockResolvedValue(undefined),
            send,
            reload: vi.fn(),
            dispose: vi.fn(),
        };
        const loadManifest = vi.fn().mockResolvedValue(loadedManifest);
        const createSession = vi.fn().mockReturnValue(session);
        const initialPayload = { component: 'BasicButton', example: { text: 'First' } };
        const { rerender } = render(
            <ComposePreviewFrame
                pluginUrl="https://plugin.example/"
                payload={initialPayload}
                loadManifest={loadManifest}
                createSession={createSession}
            />,
        );

        await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
        const iframe = screen.getByTitle('Compose component preview');

        rerender(
            <ComposePreviewFrame
                pluginUrl="https://plugin.example/"
                payload={{ component: 'BasicButton', example: { text: 'Second' } }}
                loadManifest={loadManifest}
                createSession={createSession}
            />,
        );
        await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
        expect(screen.getByTitle('Compose component preview')).toBe(iframe);

        await act(async () => first.reject(new Error('stale failure')));
        expect(screen.queryByText('stale failure')).not.toBeInTheDocument();

        await act(async () => second.reject(new Error('current failure')));
        expect(screen.getByRole('alert')).toHaveTextContent('current failure');
        expect(screen.getByTitle('Compose component preview')).toBe(iframe);
        expect(send.mock.calls[0][0]).toEqual(initialPayload);
        expect(send.mock.calls[1][0]).toEqual({ component: 'BasicButton', example: { text: 'Second' } });
    });
});
