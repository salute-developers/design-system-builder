import { isAxiosError } from 'axios';
import { http } from './http';
import { apiRoot } from './editorHttp';
import type { WebPreviewPluginDescriptor } from '../composePreview';

const isDescriptor = (value: unknown): value is WebPreviewPluginDescriptor => {
    if (typeof value !== 'object' || value === null) return false;
    const { buildId, pluginUrl } = value as Record<string, unknown>;

    return typeof buildId === 'string' && typeof pluginUrl === 'string' && Boolean(pluginUrl.trim());
};

/**
 * Запрашивает у бэкенда активный билд web-плагина превью.
 *
 * Версия дизайн-системы в запрос не передаётся: активный билд один на окружение и не зависит от того, какую
 * версию открыл пользователь. `404` означает, что web-плагин не опубликован.
 */
export const fetchWebPreviewPluginDescriptor = async (
    projectId: string,
): Promise<WebPreviewPluginDescriptor | undefined> => {
    try {
        const response = await http.get<unknown>(`${apiRoot(projectId)}/web-preview/plugin`);
        if (!isDescriptor(response.data)) throw new Error('Бэкенд вернул некорректное описание web-плагина превью');

        return response.data;
    } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return undefined;
        throw error;
    }
};
