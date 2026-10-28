import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ComposePreviewHostProvider, ComposePreviewSlot } from './ComposePreviewHost';
import { BASIC_BUTTON_PREVIEW_FIXTURE } from './basicButtonFixture';
import { ComposePreviewResultError } from './session';
import { loadedManifest } from './testFixture';
import type { PreviewComponentDescription, PreviewPayloadInput, PreviewResult } from './types';

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

const payloadFor = (componentId: string): PreviewPayloadInput => ({
    ...BASIC_BUTTON_PREVIEW_FIXTURE,
    component: { ...BASIC_BUTTON_PREVIEW_FIXTURE.component, id: componentId },
    example: { ...BASIC_BUTTON_PREVIEW_FIXTURE.example, id: componentId },
});

const descriptionOf = (componentId: string): PreviewComponentDescription => ({
    protocolVersion: 1,
    componentId,
    storyId: componentId,
    properties: [],
});

/** Сессии плагина: результаты render управляются из теста, describe отвечает сразу. */
const setupSessions = () => {
    const renders: Array<{
        sessionIndex: number;
        payload: PreviewPayloadInput;
        result: ReturnType<typeof deferred<PreviewResult>>;
    }> = [];
    const sessions: Array<{
        send: ReturnType<typeof vi.fn>;
        describeComponent: ReturnType<typeof vi.fn>;
        dispose: ReturnType<typeof vi.fn>;
    }> = [];
    const createSession = vi.fn(() => {
        const sessionIndex = sessions.length;
        let request = 0;
        const session = {
            waitUntilReady: vi.fn().mockResolvedValue(undefined),
            send: vi.fn((payload: PreviewPayloadInput) => {
                const result = deferred<PreviewResult>();
                void result.promise.catch(() => undefined);
                renders.push({ sessionIndex, payload, result });
                return { requestId: `render-${sessionIndex}-${++request}`, result: result.promise };
            }),
            describeComponent: vi.fn((componentId: string) => ({
                requestId: `describe-${sessionIndex}-${++request}`,
                result: Promise.resolve(descriptionOf(componentId)),
            })),
            reload: vi.fn(),
            dispose: vi.fn(),
        };
        sessions.push(session);
        return session;
    });
    const loadManifest = vi.fn().mockResolvedValue(loadedManifest);
    const succeed = async (index: number) => {
        const entry = renders[index];
        await act(async () => entry.result.resolve({ type: 'success', requestId: 'any' }));
    };
    return { renders, sessions, createSession, loadManifest, succeed };
};

type Shown = { platform: 'compose'; name: string } | { platform: 'web'; name: string } | undefined;

const Section = ({
    shown,
    setup,
    pluginUrl = 'https://plugin.example/',
    scope = 'project:ds:tenant',
    preload = true,
    storyId,
    onDescription,
}: {
    shown: Shown;
    setup: ReturnType<typeof setupSessions>;
    pluginUrl?: string;
    scope?: string;
    preload?: boolean;
    storyId?: string;
    onDescription?: (description: PreviewComponentDescription) => void;
}) => (
    <ComposePreviewHostProvider
        pluginUrl={pluginUrl}
        scope={scope}
        preload={preload}
        loadManifest={setup.loadManifest}
        createSession={setup.createSession as never}
    >
        {shown?.platform === 'compose' ? (
            // Каждый компонент редактора — своя область превью, как при смене компонента в разделе.
            <ComposePreviewSlot
                key={shown.name}
                pluginUrl={pluginUrl}
                owner={`compose:${shown.name}`}
                payload={payloadFor(shown.name)}
                storyId={storyId}
                onDescription={onDescription}
            />
        ) : shown ? (
            <div>Web preview {shown.name}</div>
        ) : null}
    </ComposePreviewHostProvider>
);

const iframe = () => screen.getByTitle('Compose component preview');
const host = () => screen.getByTestId('compose-preview-host');

describe('ComposePreviewHostProvider', () => {
    afterEach(cleanup);

    it('starts the plugin when the section opens, before any Compose component is shown', async () => {
        const setup = setupSessions();
        render(<Section shown={{ platform: 'web', name: 'Button' }} setup={setup} />);

        await waitFor(() => expect(setup.createSession).toHaveBeenCalledTimes(1));
        expect(host()).toHaveAttribute('aria-hidden', 'true');
        expect(setup.sessions[0].send).not.toHaveBeenCalled();
    });

    it('does not start the plugin without preload until a preview area asks for it', async () => {
        const setup = setupSessions();
        const view = render(<Section shown={{ platform: 'web', name: 'Button' }} setup={setup} preload={false} />);
        await act(async () => undefined);
        expect(setup.createSession).not.toHaveBeenCalled();
        expect(screen.queryByTitle('Compose component preview')).not.toBeInTheDocument();

        view.rerender(<Section shown={{ platform: 'compose', name: 'Avatar' }} setup={setup} preload={false} />);
        await waitFor(() => expect(setup.renders).toHaveLength(1));
        expect(setup.createSession).toHaveBeenCalledTimes(1);
    });

    it('sends describe and payload of the next Compose component to the same session and iframe', async () => {
        const setup = setupSessions();
        const onDescription = vi.fn();
        const view = render(
            <Section shown={{ platform: 'compose', name: 'Avatar' }} setup={setup} onDescription={onDescription} />,
        );
        await waitFor(() => expect(setup.renders).toHaveLength(1));
        await setup.succeed(0);
        await waitFor(() => expect(iframe()).toHaveAttribute('data-revealed', 'true'));
        const firstIframe = iframe();
        expect(host()).toHaveAttribute('aria-hidden', 'false');

        view.rerender(
            <Section shown={{ platform: 'compose', name: 'Badge' }} setup={setup} onDescription={onDescription} />,
        );
        await waitFor(() => expect(setup.renders).toHaveLength(2));

        expect(setup.createSession).toHaveBeenCalledTimes(1);
        expect(setup.loadManifest).toHaveBeenCalledTimes(1);
        expect(iframe()).toBe(firstIframe);
        expect(setup.sessions[0].describeComponent).toHaveBeenLastCalledWith('Badge');
        expect(setup.renders[1].payload.component.id).toBe('Badge');
        await waitFor(() => expect(onDescription).toHaveBeenLastCalledWith(descriptionOf('Badge')));
        // До success нового payload кадр прежнего компонента не показывается: область в состоянии загрузки.
        expect(iframe()).toHaveAttribute('data-revealed', 'false');
        expect(screen.getByText('Rendering Compose preview…')).toBeInTheDocument();

        await setup.succeed(1);
        await waitFor(() => expect(iframe()).toHaveAttribute('data-revealed', 'true'));
        expect(setup.sessions[0].dispose).not.toHaveBeenCalled();
    });

    it('passes the story of the preview area to describe and describes again when it changes', async () => {
        const setup = setupSessions();
        const view = render(<Section shown={{ platform: 'compose', name: 'Tooltip' }} setup={setup} />);
        await waitFor(() => expect(setup.sessions[0]?.describeComponent).toHaveBeenCalledTimes(1));
        expect(setup.sessions[0].describeComponent).toHaveBeenLastCalledWith('Tooltip');

        view.rerender(<Section shown={{ platform: 'compose', name: 'Tooltip' }} setup={setup} storyId="Placement" />);

        await waitFor(() => expect(setup.sessions[0].describeComponent).toHaveBeenCalledTimes(2));
        expect(setup.sessions[0].describeComponent).toHaveBeenLastCalledWith('Tooltip', 'Placement');
        expect(setup.createSession).toHaveBeenCalledTimes(1);
    });

    it('hides the iframe for a Web component and reuses the session when a Compose component returns', async () => {
        const setup = setupSessions();
        const view = render(<Section shown={{ platform: 'compose', name: 'Avatar' }} setup={setup} />);
        await waitFor(() => expect(setup.renders).toHaveLength(1));
        await setup.succeed(0);
        const firstIframe = iframe();

        view.rerender(<Section shown={{ platform: 'web', name: 'Button' }} setup={setup} />);
        expect(host()).toHaveAttribute('aria-hidden', 'true');
        expect(host()).toHaveAttribute('inert');
        expect(iframe()).toBe(firstIframe);

        view.rerender(<Section shown={{ platform: 'compose', name: 'Avatar' }} setup={setup} />);
        await waitFor(() => expect(setup.renders).toHaveLength(2));
        expect(host()).toHaveAttribute('aria-hidden', 'false');
        expect(host()).not.toHaveAttribute('inert');
        expect(iframe()).toBe(firstIframe);
        expect(setup.createSession).toHaveBeenCalledTimes(1);
        expect(setup.sessions[0].dispose).not.toHaveBeenCalled();
        expect(setup.sessions[0].describeComponent).toHaveBeenCalledTimes(2);
    });

    it('disposes the session and removes the iframe when the section is left', async () => {
        const setup = setupSessions();
        const view = render(<Section shown={{ platform: 'compose', name: 'Avatar' }} setup={setup} />);
        await waitFor(() => expect(setup.renders).toHaveLength(1));
        const firstIframe = iframe();

        view.unmount();

        expect(setup.sessions[0].dispose).toHaveBeenCalledTimes(1);
        expect(firstIframe.isConnected).toBe(false);
    });

    it('starts a new session and iframe when the design system or the plugin URL changes', async () => {
        const setup = setupSessions();
        const view = render(<Section shown={{ platform: 'compose', name: 'Avatar' }} setup={setup} />);
        await waitFor(() => expect(setup.renders).toHaveLength(1));
        const firstIframe = iframe();

        view.rerender(
            <Section shown={{ platform: 'compose', name: 'Avatar' }} setup={setup} scope="project:other:tenant" />,
        );
        await waitFor(() => expect(setup.createSession).toHaveBeenCalledTimes(2));
        expect(setup.sessions[0].dispose).toHaveBeenCalledTimes(1);
        expect(iframe()).not.toBe(firstIframe);
        await waitFor(() => expect(setup.renders.some((entry) => entry.sessionIndex === 1)).toBe(true));

        view.rerender(
            <Section
                shown={{ platform: 'compose', name: 'Avatar' }}
                setup={setup}
                scope="project:other:tenant"
                pluginUrl="https://plugin.example/next/"
            />,
        );
        await waitFor(() => expect(setup.createSession).toHaveBeenCalledTimes(3));
        expect(setup.sessions[1].dispose).toHaveBeenCalledTimes(1);
    });

    it('restarts the plugin after render_crashed and renders the next component in the new session', async () => {
        const setup = setupSessions();
        const view = render(<Section shown={{ platform: 'compose', name: 'Avatar' }} setup={setup} />);
        await waitFor(() => expect(setup.renders).toHaveLength(1));

        await act(async () =>
            setup.renders[0].result.reject(
                new ComposePreviewResultError('Compose preview stopped', {
                    type: 'failure',
                    requestId: 'render-0-1',
                    code: 'render_crashed',
                    message: 'Compose preview stopped',
                }),
            ),
        );
        await waitFor(() => expect(setup.createSession).toHaveBeenCalledTimes(2));
        expect(setup.sessions[0].dispose).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('alert')).toHaveTextContent('Превью перезапущено');
        // Payload, остановивший плагин, повторно не отправляется.
        await act(async () => undefined);
        expect(setup.renders).toHaveLength(1);

        view.rerender(<Section shown={{ platform: 'compose', name: 'Badge' }} setup={setup} />);
        await waitFor(() => expect(setup.renders).toHaveLength(2));
        expect(setup.renders[1].sessionIndex).toBe(1);
        expect(setup.renders[1].payload.component.id).toBe('Badge');
    });
});

describe('ComposePreviewHostProvider platforms', () => {
    afterEach(cleanup);

    const webPayload = {
        protocolVersion: 1 as const,
        platform: 'WEB' as const,
        assets: [],
        theme: {},
        component: { id: 'Button', variations: { view: 'accent' }, properties: {} },
        example: { id: 'Default', props: {} },
        surface: { width: 360, height: 160, background: 'dark.background.default.primary' },
    };

    it('keeps an independent host, manifest and session per platform in nested providers', async () => {
        const compose = setupSessions();
        const web = setupSessions();
        const Nested = ({ shown }: { shown: 'compose' | 'web' }) => (
            <ComposePreviewHostProvider
                pluginUrl="https://plugin.example/"
                preload
                loadManifest={compose.loadManifest}
                createSession={compose.createSession as never}
            >
                <ComposePreviewHostProvider
                    platform="web"
                    pluginUrl="https://web-plugin.example/"
                    loadManifest={web.loadManifest}
                    createSession={web.createSession as never}
                >
                    {shown === 'web' ? (
                        <ComposePreviewSlot
                            platform="web"
                            pluginUrl="https://web-plugin.example/"
                            owner="web:Button"
                            payload={webPayload}
                        />
                    ) : (
                        <ComposePreviewSlot
                            pluginUrl="https://plugin.example/"
                            owner="compose:Avatar"
                            payload={payloadFor('Avatar')}
                        />
                    )}
                </ComposePreviewHostProvider>
            </ComposePreviewHostProvider>
        );

        const view = render(<Nested shown="web" />);
        await waitFor(() => expect(web.renders).toHaveLength(1));

        expect(web.loadManifest).toHaveBeenCalledWith('https://web-plugin.example/', 'web');
        expect(compose.loadManifest).toHaveBeenCalledWith('https://plugin.example/', 'compose');
        expect(web.renders[0].payload).toEqual(webPayload);
        expect(web.sessions[0].describeComponent).toHaveBeenLastCalledWith('Button');
        expect(compose.sessions[0].send).not.toHaveBeenCalled();
        expect(screen.getByTestId('web-preview-slot')).toBeInTheDocument();
        expect(screen.getByTitle('Web component preview')).toBeInTheDocument();
        expect(screen.getByTestId('compose-preview-host')).toHaveAttribute('aria-hidden', 'true');

        view.rerender(<Nested shown="compose" />);
        await waitFor(() => expect(compose.renders).toHaveLength(1));

        expect(compose.renders[0].payload.component.id).toBe('Avatar');
        expect(web.renders).toHaveLength(1);
        expect(web.sessions[0].dispose).not.toHaveBeenCalled();
        expect(screen.getByTestId('web-preview-host')).toHaveAttribute('aria-hidden', 'true');
    });
});
