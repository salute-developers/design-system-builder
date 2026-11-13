import { http } from '../../../api/http';
import { PROJECTS_URL } from '../../../api/constants';
import { ApiError } from '../../../shared/data/apiRequest';
import type { IconCatalog } from '../domain/iconCatalog';
import { EMPTY_ICON_CATALOG } from '../domain/iconCatalog';

interface CachedCatalog {
    etag: string;
    catalog: IconCatalog;
}

const cache = new Map<string, CachedCatalog>();

const isCatalog = (value: unknown): value is IconCatalog =>
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as IconCatalog).icons) &&
    ['string', 'object'].includes(typeof (value as { assetsBaseUrl?: unknown }).assetsBaseUrl);

/** Сбрасывает кэш каталога (для тестов). */
export const resetIconCatalogCache = () => cache.clear();

/**
 * Читает каталог иконок проекта одним документом. Повторные запросы идут с `If-None-Match`: при `304` возвращается
 * ранее полученный каталог.
 */
export const getIconCatalog = async (projectId: string, signal?: AbortSignal): Promise<IconCatalog> => {
    const cached = cache.get(projectId);
    let response;
    try {
        response = await http.get<unknown>(`${PROJECTS_URL}/${projectId}/design-systems/catalog/icons`, {
            signal,
            headers: cached ? { 'If-None-Match': cached.etag } : undefined,
            validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
        });
    } catch (error) {
        if ((error as { response?: { status?: number } })?.response?.status !== undefined) {
            throw new ApiError((error as { response: { status: number } }).response.status);
        }
        throw error;
    }
    if (response.status === 304 && cached) return cached.catalog;
    if (!isCatalog(response.data)) throw new ApiError(response.status, 'invalid_catalog');
    // Без каталога или без публичного адреса хранилища backend отдаёт `assetsBaseUrl: null`.
    const catalog: IconCatalog = {
        ...EMPTY_ICON_CATALOG,
        ...response.data,
        assetsBaseUrl: (response.data as { assetsBaseUrl: string | null }).assetsBaseUrl ?? '',
    };
    const etag = response.headers?.etag;
    if (typeof etag === 'string' && etag) cache.set(projectId, { etag, catalog });
    return catalog;
};
