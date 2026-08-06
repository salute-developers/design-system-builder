import {
    LoadedComposePreviewManifest,
    PREVIEW_MESSAGE_TYPES,
    PREVIEW_PROTOCOL_VERSION,
    PreviewPayload,
    PreviewPayloadEnvelope,
    PreviewComponentDescription,
    PreviewComponentDescriptionResult,
    PreviewDescribeEnvelope,
    PreviewDescriptionEnvelope,
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

interface PendingDescription {
    componentId: string;
    resolve: (description: PreviewComponentDescription) => void;
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
    private readonly pendingDescriptions = new Map<string, PendingDescription>();
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

    send(payload: Omit<PreviewPayload, 'requestId'>): { requestId: string; result: Promise<PreviewResult> } {
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

    describeComponent(componentId: string): { requestId: string; result: Promise<PreviewComponentDescription> } {
        if (this.disposed) {
            throw new ComposePreviewDisposedError('Compose preview session is disposed');
        }
        if (!this.isReady) {
            throw new ComposePreviewError('Compose preview session is not ready');
        }
        if (!componentId.trim()) {
            throw new ComposePreviewError('Compose preview componentId must not be empty');
        }

        const requestId = this.createRequestId();
        const result = new Promise<PreviewComponentDescription>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingDescriptions.delete(requestId);
                reject(new ComposePreviewTimeoutError(`Compose preview description ${requestId} timed out`));
            }, this.timeoutMs);
            this.pendingDescriptions.set(requestId, { componentId, resolve, reject, timer });
        });
        const envelope: PreviewDescribeEnvelope = {
            type: PREVIEW_MESSAGE_TYPES.describe,
            protocolVersion: PREVIEW_PROTOCOL_VERSION,
            requestId,
            componentId,
        };
        this.targetWindow.postMessage(envelope, this.targetOrigin);

        return { requestId, result };
    }

    reload(): void {
        if (this.disposed) return;
        this.rejectPending(new ComposePreviewReloadedError('Compose preview iframe reloaded'));
        this.rejectPendingDescriptions(new ComposePreviewReloadedError('Compose preview iframe reloaded'));
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
        this.rejectPendingDescriptions(error);
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

    private rejectPendingDescriptions(error: Error): void {
        for (const pending of this.pendingDescriptions.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pendingDescriptions.clear();
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
            event.data.protocolVersion !== undefined &&
            event.data.protocolVersion !== PREVIEW_PROTOCOL_VERSION
        ) {
            return;
        }

        if (event.data.type === PREVIEW_MESSAGE_TYPES.description) {
            this.handleDescription(event.data as PreviewDescriptionEnvelope);
            return;
        }
        if (event.data.type !== PREVIEW_MESSAGE_TYPES.result) return;

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
            pending.reject(new ComposePreviewResultError(envelope.result.message, envelope.result));
        }
    };

    private handleDescription(envelope: PreviewDescriptionEnvelope): void {
        const requestId = envelope.requestId ?? envelope.result?.requestId;
        if (typeof requestId !== 'string') return;
        const pending = this.pendingDescriptions.get(requestId);
        if (!pending || !envelope.result || typeof envelope.result.type !== 'string') return;

        if (envelope.result.type === 'failure') {
            clearTimeout(pending.timer);
            this.pendingDescriptions.delete(requestId);
            pending.reject(new ComposePreviewResultError(envelope.result.message, envelope.result as PreviewResult));
            return;
        }

        const error = validateDescription(envelope.result, pending.componentId);
        clearTimeout(pending.timer);
        this.pendingDescriptions.delete(requestId);
        if (error) {
            pending.reject(new ComposePreviewError(error));
        } else {
            pending.resolve(envelope.result.description);
        }
    }
}

const validateDescription = (
    result: Extract<PreviewComponentDescriptionResult, { type: 'success' }>,
    componentId: string,
): string | undefined => {
    const description = result.description;
    if (!description || description.protocolVersion !== PREVIEW_PROTOCOL_VERSION) {
        return 'Compose preview returned an incompatible component description';
    }
    if (description.componentId !== componentId || !description.storyId.trim() || !Array.isArray(description.properties)) {
        return 'Compose preview returned a malformed component description';
    }
    const names = new Set<string>();
    for (const property of description.properties) {
        if (!property || typeof property.name !== 'string' || !property.name.trim() || names.has(property.name)) {
            return 'Compose preview returned a malformed component description';
        }
        names.add(property.name);
        if (property.name === 'variant' || property.name === 'appearance') {
            return `Compose preview description contains forbidden property ${property.name}`;
        }
        if (
            (property.type === 'string' && typeof property.defaultValue !== 'string') ||
            (property.type === 'boolean' && typeof property.defaultValue !== 'boolean') ||
            (property.type === 'int' && (!Number.isInteger(property.defaultValue))) ||
            (property.type === 'float' && typeof property.defaultValue !== 'number')
        ) {
            return `Compose preview property ${property.name} has an incompatible default value`;
        }
        if (property.type === 'singleChoice') {
            if (
                !Array.isArray(property.variants) ||
                property.variants.length === 0 ||
                !property.variants.every((variant) => typeof variant === 'string') ||
                !property.variants.includes(property.defaultValue)
            ) {
                return `Compose preview property ${property.name} has incompatible variants`;
            }
        } else if (!['string', 'boolean', 'int', 'float'].includes(property.type)) {
            return `Compose preview property ${property.name} has unsupported type`;
        }
    }
    return undefined;
};
