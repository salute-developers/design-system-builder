/**
 * TypeScript consumer projection of the canonical Preview Protocol schema.
 * The schema lives in design-system-builder-kt/preview/contract and its checked-in
 * client snapshot is verified by `npm run check:preview-schema`.
 */
export const PREVIEW_PROTOCOL_VERSION = 1;

export const PREVIEW_MESSAGE_TYPES = {
    ready: 'sdds.preview.ready',
    payload: 'sdds.preview.payload',
    result: 'sdds.preview.result',
    describe: 'sdds.preview.describe',
    description: 'sdds.preview.description',
} as const;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type PreviewPlatform = 'COMPOSE';
export type PreviewPropertySource =
    | { type: 'literal'; value: JsonValue }
    | { type: 'tokenRef'; tokenId: string };
export interface PreviewPropertyValue {
    base: PreviewPropertySource;
    states?: Record<string, PreviewPropertySource>;
}
export type PreviewAsset = {
    id: string;
    type: 'TTF' | 'OTF';
    url: string;
    digest?: string;
};
export interface PreviewFontFace {
    assetId: string;
    weight: number;
    style?: 'NORMAL' | 'ITALIC';
}
export type PreviewThemeValue =
    | { type: 'color'; value: string }
    | { type: 'dimension'; value: number }
    | { type: 'shape'; cornerRadii: [number, number, number, number] }
    | {
          type: 'typography';
          fontFamilyTokenId: string;
          fontSize: number;
          lineHeight: number;
          letterSpacing: number;
          weight: number;
      }
    | { type: 'fontFamily'; faces: PreviewFontFace[]; allowFallback: boolean };
export interface PreviewComponent {
    id: string;
    variations: Record<string, string>;
    properties: Record<string, PreviewPropertyValue>;
}
export interface PreviewExample {
    id: string;
    props: Record<string, JsonValue>;
}
export interface PreviewSurface {
    width: number;
    height: number;
    background: string;
}
export interface PreviewPayload {
    protocolVersion: 1;
    requestId: string;
    platform: PreviewPlatform;
    assets: PreviewAsset[];
    theme: Record<string, PreviewThemeValue>;
    component: PreviewComponent;
    example: PreviewExample;
    surface: PreviewSurface;
}
export type PreviewPayloadInput = Omit<PreviewPayload, 'requestId'>;

export type PreviewExamplePropertyDescription =
    | { type: 'string'; name: string; defaultValue: string }
    | { type: 'boolean'; name: string; defaultValue: boolean }
    | { type: 'int'; name: string; defaultValue: number }
    | { type: 'float'; name: string; defaultValue: number }
    | { type: 'singleChoice'; name: string; defaultValue: string; variants: string[] };
export interface PreviewComponentDescription {
    protocolVersion: 1;
    componentId: string;
    storyId: string;
    properties: PreviewExamplePropertyDescription[];
}
export type PreviewComponentDescriptionResult =
    | { type: 'success'; requestId: string; description: PreviewComponentDescription }
    | { type: 'failure'; requestId: string; code: string; message: string };

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
        describeMessageType: typeof PREVIEW_MESSAGE_TYPES.describe;
        descriptionMessageType: typeof PREVIEW_MESSAGE_TYPES.description;
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
    code: string;
    message: string;
    path?: string;
}
export type PreviewResult = PreviewResultSuccess | PreviewResultFailure;
export interface PreviewResultEnvelope {
    type: typeof PREVIEW_MESSAGE_TYPES.result;
    protocolVersion?: number;
    requestId?: string;
    result: PreviewResult;
}
export interface PreviewDescribeEnvelope {
    type: typeof PREVIEW_MESSAGE_TYPES.describe;
    protocolVersion: 1;
    requestId: string;
    componentId: string;
}
export interface PreviewDescriptionEnvelope {
    type: typeof PREVIEW_MESSAGE_TYPES.description;
    protocolVersion?: number;
    requestId?: string;
    result: PreviewComponentDescriptionResult;
}
