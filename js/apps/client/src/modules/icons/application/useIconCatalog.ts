import { useLoad } from '../../../shared/data/useLoad';
import { getIconCatalog } from '../data/iconCatalogRepository';

/** Загружает каталог иконок проекта; без `projectId` запрос не выполняется. */
export const useIconCatalog = (projectId: string | undefined) =>
    useLoad((signal) => getIconCatalog(projectId ?? '', signal), [projectId], `icons:${projectId}`, Boolean(projectId));
