import { isAxiosError } from 'axios';
import { http } from './http';
import { apiRoot } from './editorHttp';
import type { ComposePreviewPluginDescriptor } from '../composePreview';

const isDescriptor = (value: unknown): value is ComposePreviewPluginDescriptor => {
    if (typeof value !== 'object' || value === null) return false;
    const { buildId, uikitComposeVersion, pluginUrl } = value as Record<string, unknown>;

    return (
        typeof buildId === 'string' &&
        typeof uikitComposeVersion === 'string' &&
        typeof pluginUrl === 'string' &&
        Boolean(pluginUrl.trim())
    );
};

/**
 * Запрашивает у бэкенда активный билд Compose preview plugin.
 *
 * Версия дизайн-системы в запрос не передаётся: активный билд один на окружение и не зависит от того, какую
 * версию открыл пользователь. `404` означает, что плагин не опубликован.
 */
export const fetchComposePreviewPluginDescriptor = async (
    projectId: string,
): Promise<ComposePreviewPluginDescriptor | undefined> => {
    try {
        const response = await http.get<unknown>(`${apiRoot(projectId)}/compose-preview/plugin`);
        if (!isDescriptor(response.data))
            throw new Error('Бэкенд вернул некорректное описание плагина Compose-preview');

        return response.data;
    } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return undefined;
        throw error;
    }
};
