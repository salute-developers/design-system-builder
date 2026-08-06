import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ComposePreviewFrame } from './ComposePreviewFrame';
import { loadedManifest } from './testFixture';
import { PreviewPayloadInput, PreviewResult } from './types';
import { BASIC_BUTTON_PREVIEW_FIXTURE } from './basicButtonFixture';

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
    afterEach(cleanup);

    it('keeps one iframe and ignores stale status while sending a new full payload', async () => {
        const first = deferred<PreviewResult>();
        const second = deferred<PreviewResult>();
        const results = [first, second];
        let request = 0;
        const send = vi.fn((payload: PreviewPayloadInput) => {
            void payload;
            return {
                requestId: `request-${++request}`,
                result: results[request - 1].promise,
            };
        });
        const session = {
            waitUntilReady: vi.fn().mockResolvedValue(undefined),
            send,
            describeComponent: vi.fn().mockReturnValue({
                requestId: 'description-1',
                result: Promise.resolve({
                    protocolVersion: 1,
                    componentId: 'BasicButton',
                    storyId: 'BasicButton',
                    properties: [],
                }),
            }),
            reload: vi.fn(),
            dispose: vi.fn(),
        };
        const loadManifest = vi.fn().mockResolvedValue(loadedManifest);
        const createSession = vi.fn().mockReturnValue(session);
        const initialPayload = {
            ...BASIC_BUTTON_PREVIEW_FIXTURE,
            example: { ...BASIC_BUTTON_PREVIEW_FIXTURE.example, props: { label: 'First' } },
        };
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
                payload={{
                    ...BASIC_BUTTON_PREVIEW_FIXTURE,
                    example: { ...BASIC_BUTTON_PREVIEW_FIXTURE.example, props: { label: 'Second' } },
                }}
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
        expect(send.mock.calls[1][0].example.props).toEqual({ label: 'Second' });
    });

    it('repeats ready, describe and render lifecycle after iframe reload', async () => {
        const session = {
            waitUntilReady: vi.fn().mockResolvedValue(undefined),
            send: vi.fn().mockReturnValue({
                requestId: 'render',
                result: Promise.resolve({ type: 'success', requestId: 'render' }),
            }),
            describeComponent: vi.fn().mockReturnValue({
                requestId: 'description',
                result: Promise.resolve({
                    protocolVersion: 1,
                    componentId: 'BasicButton',
                    storyId: 'BasicButton',
                    properties: [],
                }),
            }),
            reload: vi.fn(),
            dispose: vi.fn(),
        };
        render(
            <ComposePreviewFrame
                pluginUrl="https://plugin.example/"
                payload={BASIC_BUTTON_PREVIEW_FIXTURE}
                loadManifest={vi.fn().mockResolvedValue(loadedManifest)}
                createSession={vi.fn().mockReturnValue(session)}
            />,
        );

        await waitFor(() => expect(session.send).toHaveBeenCalledTimes(1));
        screen.getByTitle('Compose component preview').dispatchEvent(new Event('load'));

        await waitFor(() => {
            expect(session.reload).toHaveBeenCalledTimes(1);
            expect(session.waitUntilReady).toHaveBeenCalledTimes(2);
            expect(session.describeComponent).toHaveBeenCalledTimes(2);
            expect(session.send).toHaveBeenCalledTimes(2);
        });
    });
});
