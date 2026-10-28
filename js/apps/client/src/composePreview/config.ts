/**
 * Прямой адрес плагина из сборки: переопределение для локальной разработки (`serve-compose-plugin.mjs`, сборки
 * плагина из feature-веток). Если он задан, клиент не обращается к бэкенду за адресом активного билда.
 */
export const getComposePreviewPluginOverride = (): string | undefined => {
    const value = import.meta.env.VITE_COMPOSE_PREVIEW_PLUGIN_URL?.trim();

    return value || undefined;
};

/**
 * Адрес web-плагина превью из сборки (`VITE_WEB_PREVIEW_PLUGIN_URL`). Бэкенд адрес web-плагина не публикует: без
 * переменной превью web-компонентов недоступно (область показывает причину).
 */
export const getWebPreviewPluginUrl = (): string | undefined => {
    const value = import.meta.env.VITE_WEB_PREVIEW_PLUGIN_URL?.trim();

    return value || undefined;
};
