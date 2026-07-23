import {
    LoadedComposePreviewManifest,
    PREVIEW_MESSAGE_TYPES,
    PREVIEW_PROTOCOL_VERSION,
    PreviewPayload,
    PreviewPayloadEnvelope,
    PreviewResult,
    PreviewResultEnvelope,
} from './types';

export class ComposePreviewError extends Error {}
export class ComposePreviewTimeoutError extends ComposePreviewError {}
export class ComposePreviewDisposedError extends ComposePreviewError {}
export class ComposePreviewReloadedError extends ComposePreviewError {}
export class ComposePreviewResultError extends ComposePreviewError {
    readonly result: PreviewResult;

    constructor(message: string, result: PreviewResult) {
        super(message);
        this.result = result;
    }
}

interface PendingRequest {
    resolve: (result: PreviewResult) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

interface ComposePreviewSessionOptions {
    targetWindow: Window;
    hostWindow?: Window;
    timeoutMs?: number;
    createRequestId?: () => string;
}

export class ComposePreviewSession {
    private readonly targetWindow: Window;
    private readonly hostWindow: Window;
    private readonly targetOrigin: string;
    private readonly timeoutMs: number;
    private readonly createRequestId: () => string;
    private readonly pending = new Map<string, PendingRequest>();
    private readyPromise: Promise<void>;
    private resolveReady!: () => void;
    private rejectReady!: (error: Error) => void;
    private readyTimer: ReturnType<typeof setTimeout>;
    private disposed = false;
    private isReady = false;

    constructor(plugin: LoadedComposePreviewManifest, options: ComposePreviewSessionOptions) {
        this.targetWindow = options.targetWindow;
        this.hostWindow = options.hostWindow ?? window;
        this.targetOrigin = plugin.entrypointUrl.origin;
        this.timeoutMs = options.timeoutMs ?? 10_000;
        this.createRequestId = options.createRequestId ?? (() => crypto.randomUUID());
        this.readyPromise = new Promise((resolve, reject) => {
            this.resolveReady = resolve;
            this.rejectReady = reject;
        });
        void this.readyPromise.catch(() => undefined);
        this.readyTimer = setTimeout(
            () => this.rejectReady(new ComposePreviewTimeoutError('Compose preview ready timed out')),
            this.timeoutMs,
        );
        this.hostWindow.addEventListener('message', this.handleMessage);
    }

    waitUntilReady(): Promise<void> {
        return this.readyPromise;
    }

    send(payload: PreviewPayload): { requestId: string; result: Promise<PreviewResult> } {
        if (this.disposed) {
            throw new ComposePreviewDisposedError('Compose preview session is disposed');
        }
        if (!this.isReady) {
            throw new ComposePreviewError('Compose preview session is not ready');
        }

        const requestId = this.createRequestId();
        const result = new Promise<PreviewResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new ComposePreviewTimeoutError(`Compose preview request ${requestId} timed out`));
            }, this.timeoutMs);
            this.pending.set(requestId, { resolve, reject, timer });
        });
        const envelope: PreviewPayloadEnvelope = {
            type: PREVIEW_MESSAGE_TYPES.payload,
            protocolVersion: PREVIEW_PROTOCOL_VERSION,
            requestId,
            payload: { ...payload, requestId },
        };
        this.targetWindow.postMessage(envelope, this.targetOrigin);

        return { requestId, result };
    }

    reload(): void {
        if (this.disposed) return;
        this.rejectPending(new ComposePreviewReloadedError('Compose preview iframe reloaded'));
        this.resetReady();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.hostWindow.removeEventListener('message', this.handleMessage);
        clearTimeout(this.readyTimer);
        const error = new ComposePreviewDisposedError('Compose preview session is disposed');
        if (!this.isReady) this.rejectReady(error);
        this.rejectPending(error);
    }

    private resetReady(): void {
        clearTimeout(this.readyTimer);
        this.isReady = false;
        this.readyPromise = new Promise((resolve, reject) => {
            this.resolveReady = resolve;
            this.rejectReady = reject;
        });
        void this.readyPromise.catch(() => undefined);
        this.readyTimer = setTimeout(
            () => this.rejectReady(new ComposePreviewTimeoutError('Compose preview ready timed out')),
            this.timeoutMs,
        );
    }

    private rejectPending(error: Error): void {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
    }

    private handleMessage = (event: MessageEvent): void => {
        if (this.disposed || event.source !== this.targetWindow || event.origin !== this.targetOrigin) return;
        if (!event.data || typeof event.data !== 'object') return;

        if (
            event.data.type === PREVIEW_MESSAGE_TYPES.ready &&
            event.data.protocolVersion === PREVIEW_PROTOCOL_VERSION
        ) {
            clearTimeout(this.readyTimer);
            this.isReady = true;
            this.resolveReady();
            return;
        }

        if (
            event.data.type !== PREVIEW_MESSAGE_TYPES.result ||
            (event.data.protocolVersion !== undefined &&
                event.data.protocolVersion !== PREVIEW_PROTOCOL_VERSION)
        ) {
            return;
        }

        const envelope = event.data as PreviewResultEnvelope;
        const requestId = envelope.requestId ?? envelope.result?.requestId;
        if (typeof requestId !== 'string') return;
        const pending = this.pending.get(requestId);
        if (!pending || !envelope.result || typeof envelope.result.type !== 'string') return;

        clearTimeout(pending.timer);
        this.pending.delete(requestId);
        if (envelope.result.type === 'success') {
            pending.resolve(envelope.result);
        } else {
            const message =
                envelope.result.type === 'failure'
                    ? envelope.result.message
                    : envelope.result.message ?? 'Compose preview request was superseded';
            pending.reject(new ComposePreviewResultError(message, envelope.result));
        }
    };
}
