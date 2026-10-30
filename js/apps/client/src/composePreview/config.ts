/**
 * Прямой адрес плагина из сборки: переопределение для локальной разработки (`serve-compose-plugin.mjs`, сборки
 * плагина из feature-веток). Если он задан, клиент не обращается к бэкенду за адресом активного билда.
 */
export const getComposePreviewPluginOverride = (): string | undefined => {
    const value = import.meta.env.VITE_COMPOSE_PREVIEW_PLUGIN_URL?.trim();

    return value || undefined;
};

/**
 * Прямой адрес web-плагина превью из сборки (`VITE_WEB_PREVIEW_PLUGIN_URL`): режим разработки самого плагина
 * (`vite preview` на `:3011`). Если он задан, клиент не обращается к бэкенду за адресом активного web-билда.
 */
export const getWebPreviewPluginOverride = (): string | undefined => {
    const value = import.meta.env.VITE_WEB_PREVIEW_PLUGIN_URL?.trim();

    return value || undefined;
};
