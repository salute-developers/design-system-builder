import { getComposePreviewPluginOverride } from './config';

/** Активный билд плагина, как его описывает бэкенд. */
export interface ComposePreviewPluginDescriptor {
    /** Идентификатор билда. */
    buildId: string;
    /** Версия `uikit-compose`, из которой собран плагин и импортирована мета. */
    uikitComposeVersion: string;
    /** Публичный адрес каталога билда. */
    pluginUrl: string;
}

/** Запрашивает у бэкенда активный билд проекта; `undefined`, если плагин не опубликован. */
export type PluginDescriptorFetcher = (projectId: string) => Promise<ComposePreviewPluginDescriptor | undefined>;

const resolutions = new Map<string, Promise<string | undefined>>();
let activeUrl: string | undefined;

/**
 * Адрес плагина для Compose-preview: прямое переопределение либо адрес, полученный последним вызовом
 * {@link resolveComposePreviewPluginUrl}.
 *
 * Интерфейс редактора запрашивает адрес синхронно: Compose-компоненты появляются в нём только после того, как
 * загрузка редактора разрешила адрес, поэтому к моменту показа Compose-режима значение уже известно.
 */
export const getComposePreviewPluginUrl = (): string | undefined => getComposePreviewPluginOverride() ?? activeUrl;

/**
 * Определяет адрес плагина: прямой адрес из сборки имеет приоритет и бэкенд не запрашивает; иначе адрес берётся
 * у бэкенда. Ответ кешируется на время жизни страницы для проекта, ошибка в кеше не остаётся.
 *
 * @returns адрес каталога плагина либо `undefined`, если активного билда нет.
 */
export const resolveComposePreviewPluginUrl = async (
    projectId: string,
    fetchDescriptor: PluginDescriptorFetcher,
): Promise<string | undefined> => {
    const override = getComposePreviewPluginOverride();
    if (override) return override;

    let pending = resolutions.get(projectId);
    if (!pending) {
        pending = fetchDescriptor(projectId).then((descriptor) => descriptor?.pluginUrl);
        const attempt = pending;
        void attempt.catch(() => {
            if (resolutions.get(projectId) === attempt) resolutions.delete(projectId);
        });
        resolutions.set(projectId, pending);
    }
    activeUrl = await pending;

    return activeUrl;
};

/** Забывает полученные адреса: для тестов. */
export const resetComposePreviewPluginLocation = (): void => {
    resolutions.clear();
    activeUrl = undefined;
};
