import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ComposePreviewFrame } from './ComposePreviewFrame';
import { loadedManifest } from './testFixture';
import { ComposePreviewResultError, ComposePreviewTimeoutError } from './session';
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

    const createSessionStub = (overrides: Record<string, unknown> = {}) => ({
        waitUntilReady: vi.fn().mockResolvedValue(undefined),
        send: vi.fn(),
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
        ...overrides,
    });

    it('reports an unavailable manifest and does not create a session', async () => {
        const createSession = vi.fn();

        render(
            <ComposePreviewFrame
                pluginUrl="https://plugin.example/"
                payload={BASIC_BUTTON_PREVIEW_FIXTURE}
                loadManifest={vi.fn().mockRejectedValue(new Error('Unable to load Compose preview manifest: HTTP 503'))}
                createSession={createSession}
            />,
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503');
        expect(createSession).not.toHaveBeenCalled();
    });

    it('reports a plugin that never becomes ready', async () => {
        const session = createSessionStub({
            waitUntilReady: vi.fn().mockRejectedValue(new Error('Compose preview plugin did not become ready')),
        });

        render(
            <ComposePreviewFrame
                pluginUrl="https://plugin.example/"
                payload={BASIC_BUTTON_PREVIEW_FIXTURE}
                loadManifest={vi.fn().mockResolvedValue(loadedManifest)}
                createSession={vi.fn().mockReturnValue(session)}
            />,
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('did not become ready');
        expect(session.send).not.toHaveBeenCalled();
    });

    it('keeps the iframe mounted and shows the reason when the plugin rejects a payload', async () => {
        const send = vi
            .fn()
            .mockImplementationOnce(() => ({
                requestId: 'request-1',
                result: Promise.resolve({ type: 'success', requestId: 'request-1' }),
            }))
            .mockImplementationOnce(() => ({
                requestId: 'request-2',
                result: Promise.reject(new Error('Font is unavailable')),
            }));
        const session = createSessionStub({ send });
        const props = {
            pluginUrl: 'https://plugin.example/',
            loadManifest: vi.fn().mockResolvedValue(loadedManifest),
            createSession: vi.fn().mockReturnValue(session),
        };
        const { container, rerender } = render(
            <ComposePreviewFrame {...props} payload={BASIC_BUTTON_PREVIEW_FIXTURE} />,
        );
        await waitFor(() => expect(container.querySelector('[data-status="success"]')).not.toBeNull());
        const iframe = container.querySelector('iframe');

        rerender(
            <ComposePreviewFrame
                {...props}
                payload={{
                    ...BASIC_BUTTON_PREVIEW_FIXTURE,
                    example: { ...BASIC_BUTTON_PREVIEW_FIXTURE.example, props: { label: 'Changed' } },
                }}
            />,
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('Font is unavailable');
        expect(container.querySelector('iframe')).toBe(iframe);
    });

    describe('when the plugin stops rendering', () => {
        const crashResult = (code: string): PreviewResult => ({
            type: 'failure',
            requestId: 'request-1',
            code,
            message: 'Compose preview stopped',
        });

        const setup = () => {
            let request = 0;
            const send = vi.fn((payload: PreviewPayloadInput) => {
                void payload;
                return { requestId: `request-${++request}`, result: new Promise<PreviewResult>(() => undefined) };
            });
            const makeSession = () => ({
                waitUntilReady: vi.fn().mockResolvedValue(undefined),
                send,
                describeComponent: vi.fn().mockReturnValue({
                    requestId: 'description-1',
                    result: new Promise<never>(() => undefined),
                }),
                reload: vi.fn(),
                dispose: vi.fn(),
            });
            const createSession = vi.fn(makeSession);
            const loadManifest = vi.fn().mockResolvedValue(loadedManifest);
            return { send, createSession, loadManifest };
        };

        const crash = async (send: ReturnType<typeof setup>['send'], error: Error) => {
            // Результат первого запроса отклоняется ошибкой сбоя.
            send.mockImplementationOnce(() => ({
                requestId: 'request-1',
                result: Promise.reject(error),
            }));
        };

        it('restarts the plugin after a crash and does not resend the payload that caused it', async () => {
            const { send, createSession, loadManifest } = setup();
            await crash(
                send,
                new ComposePreviewResultError('Compose preview stopped', crashResult('render_crashed')),
            );
            const payload = { ...BASIC_BUTTON_PREVIEW_FIXTURE };
            const { rerender } = render(
                <ComposePreviewFrame
                    pluginUrl="https://plugin.example/"
                    payload={payload}
                    loadManifest={loadManifest}
                    createSession={createSession}
                />,
            );

            await waitFor(() => expect(createSession).toHaveBeenCalledTimes(2));
            await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Превью перезапущено'));
            expect(send).toHaveBeenCalledTimes(1);

            // Редактор пересобирает payload при любом изменении: другой объект с тем же содержимым не повод слать снова.
            rerender(
                <ComposePreviewFrame
                    pluginUrl="https://plugin.example/"
                    payload={{ ...payload }}
                    loadManifest={loadManifest}
                    createSession={createSession}
                />,
            );
            await act(async () => undefined);
            expect(send).toHaveBeenCalledTimes(1);
            expect(createSession).toHaveBeenCalledTimes(2);
        });

        describe('crash details', () => {
            const details = { stack: 'Error: Only Sp can convert to Px\n    at Dp.toPx', consoleError: 'Only Sp can convert to Px' };

            const renderCrashed = async (result: PreviewResult) => {
                const { send, createSession, loadManifest } = setup();
                await crash(send, new ComposePreviewResultError('Compose preview stopped', result));
                render(
                    <ComposePreviewFrame
                        pluginUrl="https://plugin.example/"
                        payload={{ ...BASIC_BUTTON_PREVIEW_FIXTURE }}
                        loadManifest={loadManifest}
                        createSession={createSession}
                    />,
                );
                await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Превью перезапущено'));
            };

            afterEach(() => {
                localStorage.removeItem('debug_mode');
            });

            it('shows the cause with the stack of the crash in the debug mode', async () => {
                localStorage.setItem('debug_mode', 'true');
                await renderCrashed({ ...crashResult('render_crashed'), details } as PreviewResult);

                const block = await screen.findByTestId('compose-failure-details');
                expect(screen.queryByTestId('compose-failure-details-text')).not.toBeInTheDocument();

                fireEvent.click(within(block).getByText(/Причина/));
                const text = screen.getByTestId('compose-failure-details-text');
                expect(text).toHaveTextContent('console.error: Only Sp can convert to Px');
                expect(text).toHaveTextContent('at Dp.toPx');
            });

            it('copies the cause', async () => {
                localStorage.setItem('debug_mode', 'true');
                const writeText = vi.fn().mockResolvedValue(undefined);
                Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
                await renderCrashed({ ...crashResult('render_crashed'), details } as PreviewResult);

                fireEvent.click(within(await screen.findByTestId('compose-failure-details')).getByText('Копировать'));

                await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('at Dp.toPx')));
                expect(await screen.findByText('Скопировано')).toBeInTheDocument();
            });

            it('does not show the cause outside the debug mode', async () => {
                await renderCrashed({ ...crashResult('render_crashed'), details } as PreviewResult);

                expect(screen.queryByTestId('compose-failure-details')).not.toBeInTheDocument();
            });

            it('does not show the cause when the plugin sent no details', async () => {
                localStorage.setItem('debug_mode', 'true');
                await renderCrashed(crashResult('render_crashed'));

                expect(screen.queryByTestId('compose-failure-details')).not.toBeInTheDocument();
            });
        });

        it('sends the next payload to the restarted plugin', async () => {
            const { send, createSession, loadManifest } = setup();
            await crash(
                send,
                new ComposePreviewResultError('Compose preview stopped', crashResult('plugin_crashed')),
            );
            const { rerender } = render(
                <ComposePreviewFrame
                    pluginUrl="https://plugin.example/"
                    payload={BASIC_BUTTON_PREVIEW_FIXTURE}
                    loadManifest={loadManifest}
                    createSession={createSession}
                />,
            );
            await waitFor(() => expect(createSession).toHaveBeenCalledTimes(2));

            rerender(
                <ComposePreviewFrame
                    pluginUrl="https://plugin.example/"
                    payload={{
                        ...BASIC_BUTTON_PREVIEW_FIXTURE,
                        example: { ...BASIC_BUTTON_PREVIEW_FIXTURE.example, props: { label: 'Next' } },
                    }}
                    loadManifest={loadManifest}
                    createSession={createSession}
                />,
            );

            await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('treats a request timeout as a plugin crash', async () => {
            const { send, createSession, loadManifest } = setup();
            await crash(send, new ComposePreviewTimeoutError('Compose preview request request-1 timed out'));
            render(
                <ComposePreviewFrame
                    pluginUrl="https://plugin.example/"
                    payload={BASIC_BUTTON_PREVIEW_FIXTURE}
                    loadManifest={loadManifest}
                    createSession={createSession}
                />,
            );

            await waitFor(() => expect(createSession).toHaveBeenCalledTimes(2));
        });

        it('does not restart the plugin when a hidden page cannot confirm a frame, and renders again when shown', async () => {
            const { send, createSession, loadManifest } = setup();
            await crash(send, new ComposePreviewTimeoutError('Compose preview request request-1 timed out'));
            const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
            render(
                <ComposePreviewFrame
                    pluginUrl="https://plugin.example/"
                    payload={BASIC_BUTTON_PREVIEW_FIXTURE}
                    loadManifest={loadManifest}
                    createSession={createSession}
                />,
            );
            await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
            await act(async () => undefined);
            expect(createSession).toHaveBeenCalledTimes(1);

            visibility.mockReturnValue('visible');
            await act(async () => {
                document.dispatchEvent(new Event('visibilitychange'));
            });

            await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
            expect(createSession).toHaveBeenCalledTimes(1);
            visibility.mockRestore();
        });

        it('does not send to a session that is still loading and sends the latest payload once it is ready', async () => {
            const crashError = new ComposePreviewResultError('Compose preview stopped', crashResult('render_crashed'));
            const sessions: Array<{ ready: boolean; markReady: () => void; send: ReturnType<typeof vi.fn> }> = [];
            const createSession = vi.fn(() => {
                const state = { ready: false, markReady: () => undefined, send: vi.fn() };
                const readyPromise = new Promise<void>((resolve) => {
                    state.markReady = () => {
                        state.ready = true;
                        resolve();
                    };
                });
                // Как настоящая сессия: send до готовности бросает исключение синхронно.
                state.send = vi.fn((payload: PreviewPayloadInput) => {
                    void payload;
                    if (!state.ready) throw new Error('Compose preview session is not ready');
                    return {
                        requestId: `request-${sessions.indexOf(state)}`,
                        result: sessions.indexOf(state) === 0
                            ? Promise.reject(crashError)
                            : new Promise<PreviewResult>(() => undefined),
                    };
                });
                sessions.push(state);
                return {
                    waitUntilReady: () => readyPromise,
                    send: state.send,
                    describeComponent: vi.fn(() => {
                        if (!state.ready) throw new Error('Compose preview session is not ready');
                        return { requestId: 'description', result: new Promise<never>(() => undefined) };
                    }),
                    reload: vi.fn(),
                    dispose: vi.fn(),
                };
            });
            const loadManifest = vi.fn().mockResolvedValue(loadedManifest);
            const element = (props: Record<string, unknown>) => (
                <ComposePreviewFrame
                    pluginUrl="https://plugin.example/"
                    payload={{
                        ...BASIC_BUTTON_PREVIEW_FIXTURE,
                        example: { ...BASIC_BUTTON_PREVIEW_FIXTURE.example, props },
                    }}
                    loadManifest={loadManifest}
                    createSession={createSession as never}
                />
            );
            const { rerender } = render(element({ label: 'First' }));
            await waitFor(() => expect(sessions).toHaveLength(1));
            await act(async () => sessions[0].markReady());
            // Первый payload останавливает плагин: iframe перезапускается, вторая сессия ещё не готова.
            await waitFor(() => expect(sessions).toHaveLength(2));

            // Правка редактора во время перезапуска не должна дойти до неготовой сессии.
            rerender(element({ label: 'Second' }));
            await act(async () => undefined);
            expect(sessions[1].send).not.toHaveBeenCalled();

            await act(async () => sessions[1].markReady());
            await waitFor(() => expect(sessions[1].send).toHaveBeenCalledTimes(1));
            expect(sessions[1].send.mock.calls[0][0].example.props).toEqual({ label: 'Second' });
        });

        it('does not restart the plugin when it merely rejects a payload', async () => {
            const { send, createSession, loadManifest } = setup();
            await crash(
                send,
                new ComposePreviewResultError('Unknown token', {
                    type: 'failure',
                    requestId: 'request-1',
                    code: 'preview_preparation_failed',
                    message: 'Unknown token',
                }),
            );
            render(
                <ComposePreviewFrame
                    pluginUrl="https://plugin.example/"
                    payload={BASIC_BUTTON_PREVIEW_FIXTURE}
                    loadManifest={loadManifest}
                    createSession={createSession}
                />,
            );

            expect(await screen.findByRole('alert')).toHaveTextContent('Unknown token');
            expect(createSession).toHaveBeenCalledTimes(1);
        });
    });
});
