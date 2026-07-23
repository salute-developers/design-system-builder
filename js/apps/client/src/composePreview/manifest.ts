import {
    ComposePreviewManifest,
    LoadedComposePreviewManifest,
    PREVIEW_MESSAGE_TYPES,
    PREVIEW_PROTOCOL_VERSION,
} from './types';

const MANIFEST_FILE = 'preview-plugin.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExpectedMessages = (value: unknown): value is ComposePreviewManifest['payloadBridge'] =>
    isRecord(value) &&
    value.readyMessageType === PREVIEW_MESSAGE_TYPES.ready &&
    value.payloadMessageType === PREVIEW_MESSAGE_TYPES.payload &&
    value.resultMessageType === PREVIEW_MESSAGE_TYPES.result;

export const validateComposePreviewManifest = (value: unknown): ComposePreviewManifest => {
    if (!isRecord(value)) {
        throw new Error('Compose preview manifest must be an object');
    }
    if (value.schemaVersion !== 1) {
        throw new Error('Unsupported Compose preview manifest schemaVersion');
    }
    if (value.platform !== 'compose') {
        throw new Error('Compose preview manifest has an unsupported platform');
    }
    if (value.protocolVersion !== PREVIEW_PROTOCOL_VERSION) {
        throw new Error('Compose preview manifest has an unsupported protocolVersion');
    }
    if (typeof value.entrypoint !== 'string' || !value.entrypoint.trim()) {
        throw new Error('Compose preview manifest must define a non-empty entrypoint');
    }
    if (!hasExpectedMessages(value.payloadBridge)) {
        throw new Error('Compose preview manifest does not define the required bridge messages');
    }
    if (!Array.isArray(value.components) || !value.components.includes('BasicButton')) {
        throw new Error('Compose preview manifest does not support BasicButton');
    }

    return value as unknown as ComposePreviewManifest;
};

export const loadComposePreviewManifest = async (
    pluginBaseUrl: string,
    fetcher: typeof fetch = fetch,
): Promise<LoadedComposePreviewManifest> => {
    let manifestUrl: URL;

    try {
        const baseUrl = new URL(pluginBaseUrl);
        manifestUrl = new URL(MANIFEST_FILE, baseUrl.href.endsWith('/') ? baseUrl : `${baseUrl.href}/`);
    } catch {
        throw new Error(`Invalid Compose preview plugin URL: ${pluginBaseUrl}`);
    }

    let response: Response;
    try {
        response = await fetcher(manifestUrl);
    } catch (error) {
        throw new Error(`Unable to load Compose preview manifest: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
        throw new Error(`Unable to load Compose preview manifest: HTTP ${response.status}`);
    }

    let manifestValue: unknown;
    try {
        manifestValue = await response.json();
    } catch {
        throw new Error('Compose preview manifest is not valid JSON');
    }

    const manifest = validateComposePreviewManifest(manifestValue);
    let entrypointUrl: URL;
    try {
        entrypointUrl = new URL(manifest.entrypoint, manifestUrl);
    } catch {
        throw new Error(`Invalid Compose preview entrypoint: ${manifest.entrypoint}`);
    }

    return { manifest, manifestUrl, entrypointUrl };
};
