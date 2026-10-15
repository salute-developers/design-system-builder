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
    | { type: 'literal'; value: JsonValue; alpha?: number }
    | { type: 'tokenRef'; tokenId: string; alpha?: number }
    | { type: 'styleRef'; styleId: string }
    | { type: 'assetRef'; assetId: string };
/** Значение для набора одновременно активных состояний. */
export interface PreviewStateEntry {
    when: string[];
    source: PreviewPropertySource;
}
export interface PreviewPropertyValue {
    base: PreviewPropertySource;
    states?: PreviewStateEntry[];
}
/** Вложенный стиль, на который ссылается `styleRef`. */
export interface PreviewStyle {
    component: string;
    properties: Record<string, PreviewPropertyValue>;
}
export type PreviewAsset = {
    id: string;
    type: 'TTF' | 'OTF' | 'SVG' | 'PNG';
    url: string;
    digest?: string;
};
export interface PreviewFontFace {
    assetId: string;
    weight: number;
    style?: 'NORMAL' | 'ITALIC';
}
export interface PreviewShadowLayer {
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: string;
}
export interface PreviewGradientStop {
    color: string;
    position: number;
}
export interface PreviewGradientLayer {
    kind: 'linear';
    angle: number;
    stops: PreviewGradientStop[];
}
export type PreviewThemeValue =
    | { type: 'shadow'; layers: PreviewShadowLayer[] }
    | { type: 'gradient'; layers: PreviewGradientLayer[] }
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
    /** Вложенные стили; присутствует, только если на них есть `styleRef`. */
    styles?: Record<string, PreviewStyle>;
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
    | { type: 'failure'; requestId: string; code: string; message: string; details?: PreviewFailureDetails };

/** Группа компонентов песочницы: имя и компоненты, которые в неё входят. */
export interface ComposePreviewComponentGroup {
    name: string;
    components: string[];
}

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
    /** Группы компонентов песочницы; нет у плагина без поддержки групп. */
    groups?: ComposePreviewComponentGroup[];
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
export interface PreviewWarning {
    code: string;
    message: string;
    path?: string;
}
export interface PreviewResultSuccess {
    type: 'success';
    requestId: string;
    warnings?: PreviewWarning[];
}
/** Причина остановки плагина: stack исключения и последняя запись `console.error` плагина. */
export interface PreviewFailureDetails {
    stack?: string;
    consoleError?: string;
}
export interface PreviewResultFailure {
    type: 'failure';
    requestId: string;
    code: string;
    message: string;
    path?: string;
    details?: PreviewFailureDetails;
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
