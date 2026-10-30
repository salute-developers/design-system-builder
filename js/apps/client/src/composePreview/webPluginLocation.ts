import { getWebPreviewPluginOverride } from './config';

/** Активный билд web-плагина, как его описывает бэкенд (`GET /api/projects/{projectId}/ds/web-preview/plugin`). */
export interface WebPreviewPluginDescriptor {
    /** Идентификатор билда. */
    buildId: string;
    /** Платформа билда: `web`. */
    platform?: string;
    /** Версия `plasma-new-hope`, из которой собран плагин и импортирована мета. */
    libraryVersion?: string;
    /** sha256 импортированной API-меты. */
    metaSha256?: string;
    /** Версия Preview Protocol плагина. */
    protocolVersion?: number;
    /** Публичный адрес каталога билда. */
    pluginUrl: string;
    /** Время публикации билда. */
    publishedAt?: string;
}

/** Запрашивает у бэкенда активный web-билд проекта; `undefined`, если web-плагин не опубликован. */
export type WebPluginDescriptorFetcher = (projectId: string) => Promise<WebPreviewPluginDescriptor | undefined>;

const resolutions = new Map<string, Promise<string | undefined>>();

/**
 * Определяет адрес web-плагина: прямой адрес из сборки (`VITE_WEB_PREVIEW_PLUGIN_URL`) имеет приоритет и бэкенд не
 * запрашивает; иначе адрес берётся у бэкенда. Ответ кешируется на время жизни страницы для проекта, ошибка в кеше не
 * остаётся. Версия дизайн-системы в запрос не входит: активный билд один на окружение.
 *
 * @returns адрес каталога плагина либо `undefined`, если активного web-билда нет.
 */
export const resolveWebPreviewPluginUrl = (
    projectId: string,
    fetchDescriptor: WebPluginDescriptorFetcher,
): Promise<string | undefined> => {
    const override = getWebPreviewPluginOverride();
    if (override) return Promise.resolve(override);

    let pending = resolutions.get(projectId);
    if (!pending) {
        pending = fetchDescriptor(projectId).then((descriptor) => descriptor?.pluginUrl);
        const attempt = pending;
        void attempt.catch(() => {
            if (resolutions.get(projectId) === attempt) resolutions.delete(projectId);
        });
        resolutions.set(projectId, pending);
    }

    return pending;
};

/** Забывает полученные адреса web-плагина: для тестов. */
export const resetWebPreviewPluginLocation = (): void => {
    resolutions.clear();
};
