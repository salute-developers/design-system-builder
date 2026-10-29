/**
 * Прямой адрес плагина из сборки: переопределение для локальной разработки (`serve-compose-plugin.mjs`, сборки
 * плагина из feature-веток). Если он задан, клиент не обращается к бэкенду за адресом активного билда.
 */
export const getComposePreviewPluginOverride = (): string | undefined => {
    const value = import.meta.env.VITE_COMPOSE_PREVIEW_PLUGIN_URL?.trim();

    return value || undefined;
};
