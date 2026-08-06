import { ComposePreviewManifest, LoadedComposePreviewManifest, PREVIEW_MESSAGE_TYPES } from './types';

export const compatibleManifest: ComposePreviewManifest = {
    schemaVersion: 1,
    platform: 'compose',
    protocolVersion: 1,
    entrypoint: 'index.html',
    payloadBridge: {
        readyMessageType: PREVIEW_MESSAGE_TYPES.ready,
        payloadMessageType: PREVIEW_MESSAGE_TYPES.payload,
        resultMessageType: PREVIEW_MESSAGE_TYPES.result,
        describeMessageType: PREVIEW_MESSAGE_TYPES.describe,
        descriptionMessageType: PREVIEW_MESSAGE_TYPES.description,
    },
    components: ['BasicButton'],
};

export const loadedManifest: LoadedComposePreviewManifest = {
    manifest: compatibleManifest,
    manifestUrl: new URL('https://plugin.example/preview-plugin.json'),
    entrypointUrl: new URL('https://plugin.example/index.html'),
};
