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
        expect(() => session.send({ component: 'BasicButton' })).toThrow('not ready');

        ready(hostWindow, targetWindow);
        await expect(session.waitUntilReady()).resolves.toBeUndefined();
        session.dispose();
    });

    it('correlates success and failure without confusing pending requests', async () => {
        const { hostWindow, targetWindow, session } = createSession();
        ready(hostWindow, targetWindow);
        await session.waitUntilReady();
        const first = session.send({ value: 1 });
        const second = session.send({ value: 2 });

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
            result: { type: 'superseded', requestId: first.requestId },
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
        const render = second.session.send({ value: true });
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
        const request = reloaded.session.send({ value: true });
        reloaded.session.reload();
        await expect(request.result).rejects.toBeInstanceOf(ComposePreviewReloadedError);
        reloaded.session.dispose();

        const disposed = createSession();
        ready(disposed.hostWindow, disposed.targetWindow);
        await disposed.session.waitUntilReady();
        const pending = disposed.session.send({ value: true });
        disposed.session.dispose();
        await expect(pending.result).rejects.toBeInstanceOf(ComposePreviewDisposedError);
    });
});
