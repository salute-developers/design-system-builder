import {
    ComposePreviewComponentGroup,
    ComposePreviewManifest,
    LoadedComposePreviewManifest,
    PREVIEW_MESSAGE_TYPES,
    PREVIEW_PROTOCOL_VERSION,
    PreviewPluginPlatform,
} from './types';

const MANIFEST_FILE = 'preview-plugin.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExpectedMessages = (value: unknown): value is ComposePreviewManifest['payloadBridge'] =>
    isRecord(value) &&
    value.readyMessageType === PREVIEW_MESSAGE_TYPES.ready &&
    value.payloadMessageType === PREVIEW_MESSAGE_TYPES.payload &&
    value.resultMessageType === PREVIEW_MESSAGE_TYPES.result &&
    value.describeMessageType === PREVIEW_MESSAGE_TYPES.describe &&
    value.descriptionMessageType === PREVIEW_MESSAGE_TYPES.description;

/** Корректные группы либо `undefined`: неверный формат отбрасывается целиком, манифест остаётся рабочим. */
const parseGroups = (value: unknown): ComposePreviewComponentGroup[] | undefined => {
    if (!Array.isArray(value)) return undefined;

    const isGroup = (group: unknown): group is ComposePreviewComponentGroup =>
        isRecord(group) &&
        typeof group.name === 'string' &&
        Boolean(group.name.trim()) &&
        Array.isArray(group.components) &&
        group.components.every((component) => typeof component === 'string' && component.trim());

    return value.every(isGroup) ? value.map(({ name, components }) => ({ name, components })) : undefined;
};

/**
 * Проверяет манифест плагина превью ожидаемой платформы: `compose` для Compose-компонентов, `web` для web-компонентов.
 * Манифест другой платформы отклоняется.
 */
export const validateComposePreviewManifest = (
    value: unknown,
    expectedPlatform: PreviewPluginPlatform = 'compose',
): ComposePreviewManifest => {
    if (!isRecord(value)) {
        throw new Error('Preview plugin manifest must be an object');
    }
    if (value.schemaVersion !== 1) {
        throw new Error('Unsupported preview plugin manifest schemaVersion');
    }
    if (value.platform !== expectedPlatform) {
        throw new Error(
            `Preview plugin manifest has an unsupported platform: expected ${expectedPlatform}, got ${String(value.platform)}`,
        );
    }
    if (value.protocolVersion !== PREVIEW_PROTOCOL_VERSION) {
        throw new Error('Preview plugin manifest has an unsupported protocolVersion');
    }
    if (typeof value.entrypoint !== 'string' || !value.entrypoint.trim()) {
        throw new Error('Preview plugin manifest must define a non-empty entrypoint');
    }
    if (!hasExpectedMessages(value.payloadBridge)) {
        throw new Error('Preview plugin manifest does not define the required bridge messages');
    }
    if (
        !Array.isArray(value.components) ||
        !value.components.every((component) => typeof component === 'string' && component.trim())
    ) {
        throw new Error('Preview plugin manifest must list its components as non-empty strings');
    }

    const { groups: rawGroups, ...rest } = value;
    const groups = parseGroups(rawGroups);

    return { ...rest, ...(groups ? { groups } : {}) } as unknown as ComposePreviewManifest;
};

const fetchComposePreviewManifest = async (
    pluginBaseUrl: string,
    platform: PreviewPluginPlatform,
    fetcher: typeof fetch,
): Promise<LoadedComposePreviewManifest> => {
    let manifestUrl: URL;

    try {
        const baseUrl = new URL(pluginBaseUrl);
        manifestUrl = new URL(MANIFEST_FILE, baseUrl.href.endsWith('/') ? baseUrl : `${baseUrl.href}/`);
    } catch {
        throw new Error(`Invalid preview plugin URL: ${pluginBaseUrl}`);
    }

    let response: Response;
    try {
        response = await fetcher(manifestUrl);
    } catch (error) {
        throw new Error(`Unable to load preview plugin manifest: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
        throw new Error(`Unable to load preview plugin manifest: HTTP ${response.status}`);
    }

    let manifestValue: unknown;
    try {
        manifestValue = await response.json();
    } catch {
        throw new Error('Preview plugin manifest is not valid JSON');
    }

    const manifest = validateComposePreviewManifest(manifestValue, platform);
    let entrypointUrl: URL;
    try {
        entrypointUrl = new URL(manifest.entrypoint, manifestUrl);
    } catch {
        throw new Error(`Invalid preview plugin entrypoint: ${manifest.entrypoint}`);
    }

    if (entrypointUrl.origin !== manifestUrl.origin) {
        throw new Error(`Preview plugin entrypoint must be served from the plugin origin: ${manifest.entrypoint}`);
    }

    return { manifest, manifestUrl, entrypointUrl };
};

const manifestCache = new Map<string, Promise<LoadedComposePreviewManifest>>();

/**
 * Загружает manifest плагина превью платформы `platform` (по умолчанию `compose`) и отклоняет манифест другой
 * платформы. Манифест с настоящим `fetch` запоминается на время жизни страницы: редактор спрашивает его при каждом
 * переключении компонента, а он меняется только вместе с плагином (после перезагрузки страницы). Ошибка в кеше не
 * остаётся. С подменённым `fetcher` (тесты) кеш не используется.
 */
export const loadComposePreviewManifest = (
    pluginBaseUrl: string,
    platform: PreviewPluginPlatform = 'compose',
    fetcher: typeof fetch = fetch,
): Promise<LoadedComposePreviewManifest> => {
    if (fetcher !== fetch) return fetchComposePreviewManifest(pluginBaseUrl, platform, fetcher);

    const cacheKey = `${platform}\n${pluginBaseUrl}`;
    const cached = manifestCache.get(cacheKey);
    if (cached) return cached;

    const loading = fetchComposePreviewManifest(pluginBaseUrl, platform, fetcher).catch((error) => {
        manifestCache.delete(cacheKey);
        throw error;
    });
    manifestCache.set(cacheKey, loading);

    return loading;
};
