export const PREVIEW_PROTOCOL_VERSION = 1;

export const PREVIEW_MESSAGE_TYPES = {
    ready: 'sdds.preview.ready',
    payload: 'sdds.preview.payload',
    result: 'sdds.preview.result',
} as const;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type PreviewPayload = Record<string, JsonValue>;

export interface ComposePreviewManifest {
    schemaVersion: 1;
    platform: 'compose';
    protocolVersion: 1;
    entrypoint: string;
    payloadBridge: {
        direct?: string;
        readyMessageType: typeof PREVIEW_MESSAGE_TYPES.ready;
        payloadMessageType: typeof PREVIEW_MESSAGE_TYPES.payload;
        resultMessageType: typeof PREVIEW_MESSAGE_TYPES.result;
    };
    components: string[];
}

export interface LoadedComposePreviewManifest {
    manifest: ComposePreviewManifest;
    manifestUrl: URL;
    entrypointUrl: URL;
}

export interface PreviewReadyEnvelope {
    type: typeof PREVIEW_MESSAGE_TYPES.ready;
    protocolVersion: number;
}

export interface PreviewPayloadEnvelope {
    type: typeof PREVIEW_MESSAGE_TYPES.payload;
    protocolVersion: 1;
    requestId: string;
    payload: PreviewPayload;
}

export interface PreviewResultSuccess {
    type: 'success';
    requestId: string;
}

export interface PreviewResultFailure {
    type: 'failure';
    requestId: string;
    code?: string;
    message: string;
}

export interface PreviewResultSuperseded {
    type: 'superseded';
    requestId: string;
    message?: string;
}

export type PreviewResult = PreviewResultSuccess | PreviewResultFailure | PreviewResultSuperseded;

export interface PreviewResultEnvelope {
    type: typeof PREVIEW_MESSAGE_TYPES.result;
    protocolVersion?: number;
    requestId?: string;
    result: PreviewResult;
}
