import { describe, expect, it, vi } from 'vitest';

import {
    ComposePreviewDisposedError,
    ComposePreviewReloadedError,
    ComposePreviewResultError,
    ComposePreviewSession,
    ComposePreviewTimeoutError,
} from './session';
import { loadedManifest } from './testFixture';
import { PREVIEW_MESSAGE_TYPES } from './types';
import { BASIC_BUTTON_PREVIEW_FIXTURE } from './basicButtonFixture';

class HostWindow extends EventTarget {
    emit(source: MessageEventSource | null, origin: string, data: unknown) {
        this.dispatchEvent(new MessageEvent('message', { source, origin, data }));
    }
}

const createSession = (timeoutMs = 100) => {
    const hostWindow = new HostWindow();
    const targetWindow = { postMessage: vi.fn() } as unknown as Window;
    let id = 0;
    const session = new ComposePreviewSession(loadedManifest, {
        hostWindow: hostWindow as unknown as Window,
        targetWindow,
        timeoutMs,
        createRequestId: () => `request-${++id}`,
    });
    return { hostWindow, targetWindow, session };
};

const ready = (host: HostWindow, target: Window, origin = 'https://plugin.example') =>
    host.emit(target, origin, { type: PREVIEW_MESSAGE_TYPES.ready, protocolVersion: 1 });

describe('ComposePreviewSession', () => {
    it('accepts ready only from the exact iframe source and origin', async () => {
        const { hostWindow, targetWindow, session } = createSession();
        hostWindow.emit({} as Window, 'https://plugin.example', {
            type: PREVIEW_MESSAGE_TYPES.ready,
            protocolVersion: 1,
        });
        hostWindow.emit(targetWindow, 'https://attacker.example', {
            type: PREVIEW_MESSAGE_TYPES.ready,
            protocolVersion: 1,
        });
        expect(() => session.send(BASIC_BUTTON_PREVIEW_FIXTURE)).toThrow('not ready');

        ready(hostWindow, targetWindow);
        await expect(session.waitUntilReady()).resolves.toBeUndefined();
        session.dispose();
    });

    it('correlates success and failure without confusing pending requests', async () => {
        const { hostWindow, targetWindow, session } = createSession();
        ready(hostWindow, targetWindow);
        await session.waitUntilReady();
        const first = session.send(BASIC_BUTTON_PREVIEW_FIXTURE);
        const second = session.send(BASIC_BUTTON_PREVIEW_FIXTURE);

        hostWindow.emit(targetWindow, 'https://plugin.example', {
            type: PREVIEW_MESSAGE_TYPES.result,
            protocolVersion: 1,
            requestId: second.requestId,
            result: { type: 'success', requestId: second.requestId },
        });
        await expect(second.result).resolves.toEqual({ type: 'success', requestId: second.requestId });

        hostWindow.emit(targetWindow, 'https://plugin.example', {
            type: PREVIEW_MESSAGE_TYPES.result,
            protocolVersion: 1,
            requestId: first.requestId,
            result: { type: 'failure', code: 'superseded', message: 'Superseded', requestId: first.requestId },
        });
        await expect(first.result).rejects.toBeInstanceOf(ComposePreviewResultError);
        session.dispose();
    });

    it('times out ready and render waits', async () => {
        vi.useFakeTimers();
        const first = createSession(10);
        const readyResult = expect(first.session.waitUntilReady()).rejects.toBeInstanceOf(ComposePreviewTimeoutError);
        await vi.advanceTimersByTimeAsync(10);
        await readyResult;
        first.session.dispose();

        const second = createSession(10);
        ready(second.hostWindow, second.targetWindow);
        await second.session.waitUntilReady();
        const render = second.session.send(BASIC_BUTTON_PREVIEW_FIXTURE);
        const renderResult = expect(render.result).rejects.toBeInstanceOf(ComposePreviewTimeoutError);
        await vi.advanceTimersByTimeAsync(10);
        await renderResult;
        second.session.dispose();
        vi.useRealTimers();
    });

    it('rejects pending work on reload and disposal', async () => {
        const reloaded = createSession();
        ready(reloaded.hostWindow, reloaded.targetWindow);
        await reloaded.session.waitUntilReady();
        const request = reloaded.session.send(BASIC_BUTTON_PREVIEW_FIXTURE);
        reloaded.session.reload();
        await expect(request.result).rejects.toBeInstanceOf(ComposePreviewReloadedError);
        reloaded.session.dispose();

        const disposed = createSession();
        ready(disposed.hostWindow, disposed.targetWindow);
        await disposed.session.waitUntilReady();
        const pending = disposed.session.send(BASIC_BUTTON_PREVIEW_FIXTURE);
        disposed.session.dispose();
        await expect(pending.result).rejects.toBeInstanceOf(ComposePreviewDisposedError);
    });

    it('describes a component independently from render requests', async () => {
        const { hostWindow, targetWindow, session } = createSession();
        ready(hostWindow, targetWindow);
        await session.waitUntilReady();
        const render = session.send(BASIC_BUTTON_PREVIEW_FIXTURE);
        const described = session.describeComponent('BasicButton');

        expect(targetWindow.postMessage).toHaveBeenLastCalledWith(
            {
                type: PREVIEW_MESSAGE_TYPES.describe,
                protocolVersion: 1,
                requestId: described.requestId,
                componentId: 'BasicButton',
            },
            'https://plugin.example',
        );
        hostWindow.emit(targetWindow, 'https://plugin.example', {
            type: PREVIEW_MESSAGE_TYPES.description,
            result: {
                type: 'success',
                requestId: described.requestId,
                description: {
                    protocolVersion: 1,
                    componentId: 'BasicButton',
                    storyId: 'BasicButton',
                    properties: [{ type: 'string', name: 'label', defaultValue: 'label' }],
                },
            },
        });
        await expect(described.result).resolves.toMatchObject({ componentId: 'BasicButton' });

        hostWindow.emit(targetWindow, 'https://plugin.example', {
            type: PREVIEW_MESSAGE_TYPES.result,
            result: { type: 'success', requestId: render.requestId },
        });
        await expect(render.result).resolves.toMatchObject({ requestId: render.requestId });
        session.dispose();
    });

    it('rejects unknown and malformed descriptions while ignoring stale sources', async () => {
        const { hostWindow, targetWindow, session } = createSession();
        ready(hostWindow, targetWindow);
        await session.waitUntilReady();

        const unknown = session.describeComponent('Unknown');
        hostWindow.emit(targetWindow, 'https://plugin.example', {
            type: PREVIEW_MESSAGE_TYPES.description,
            result: {
                type: 'failure',
                requestId: unknown.requestId,
                code: 'unknown_component',
                message: 'Unknown component',
            },
        });
        await expect(unknown.result).rejects.toBeInstanceOf(ComposePreviewResultError);

        const malformed = session.describeComponent('BasicButton');
        hostWindow.emit({} as Window, 'https://plugin.example', {
            type: PREVIEW_MESSAGE_TYPES.description,
            result: {
                type: 'success',
                requestId: malformed.requestId,
                description: {},
            },
        });
        hostWindow.emit(targetWindow, 'https://attacker.example', {
            type: PREVIEW_MESSAGE_TYPES.description,
            result: {
                type: 'success',
                requestId: malformed.requestId,
                description: {},
            },
        });
        hostWindow.emit(targetWindow, 'https://plugin.example', {
            type: PREVIEW_MESSAGE_TYPES.description,
            result: {
                type: 'success',
                requestId: malformed.requestId,
                description: {
                    protocolVersion: 1,
                    componentId: 'BasicButton',
                    storyId: 'BasicButton',
                    properties: [{ type: 'singleChoice', name: 'icon', defaultValue: 'Missing', variants: ['Start'] }],
                },
            },
        });
        await expect(malformed.result).rejects.toThrow('incompatible variants');
        session.dispose();
    });

    it('times out and cleans up description requests on reload and disposal', async () => {
        vi.useFakeTimers();
        const timedOut = createSession(10);
        ready(timedOut.hostWindow, timedOut.targetWindow);
        await timedOut.session.waitUntilReady();
        const timedOutDescription = timedOut.session.describeComponent('BasicButton');
        const timeoutResult = expect(timedOutDescription.result).rejects.toBeInstanceOf(ComposePreviewTimeoutError);
        await vi.advanceTimersByTimeAsync(10);
        await timeoutResult;
        timedOut.session.dispose();

        const reloaded = createSession();
        ready(reloaded.hostWindow, reloaded.targetWindow);
        await reloaded.session.waitUntilReady();
        const reloadedDescription = reloaded.session.describeComponent('BasicButton');
        reloaded.session.reload();
        await expect(reloadedDescription.result).rejects.toBeInstanceOf(ComposePreviewReloadedError);
        reloaded.session.dispose();

        const disposed = createSession();
        ready(disposed.hostWindow, disposed.targetWindow);
        await disposed.session.waitUntilReady();
        const disposedDescription = disposed.session.describeComponent('BasicButton');
        disposed.session.dispose();
        await expect(disposedDescription.result).rejects.toBeInstanceOf(ComposePreviewDisposedError);
        vi.useRealTimers();
    });
});
