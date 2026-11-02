import { readEditor } from '../../../api/editorReads';
import { invalidateQueryCache } from '../../../shared/data/useLoad';
import { http } from '../../../api/http';
import { apiRequest } from '../../../shared/data/apiRequest';
import type { DesignSystem, DesignSystemTokenDefinition } from '../domain/designSystem';

const projectPath = (suffix = '') => `/api/projects${suffix}`;
const dsPath = (projectId: string, suffix: string) => projectPath(`/${projectId}/ds${suffix}`);

const changed = async <T>(projectId: string, operation: () => Promise<{ data: T }>, id?: string) => {
    const value = await apiRequest<T>(operation);
    invalidateQueryCache(
        'projects',
        `project:${projectId}`,
        `systems:${projectId}`,
        ...(id ? [`system:${projectId}:${id}`] : []),
    );
    return value;
};

export const designSystemsApi = {
    list: (projectId: string, signal?: AbortSignal) =>
        apiRequest<DesignSystem[]>(() =>
            readEditor<DesignSystem[]>(dsPath(projectId, '/design-systems'), { signal }, undefined, 30_000),
        ),
    get: (projectId: string, id: string, signal?: AbortSignal) =>
        apiRequest<DesignSystem>(() =>
            readEditor<DesignSystem>(dsPath(projectId, `/design-systems/${id}`), { signal }, undefined, 30_000),
        ),
    create: (projectId: string, body: { name: string; projectName: string; description?: string }) =>
        changed<DesignSystem>(projectId, () => http.post(dsPath(projectId, '/design-systems'), { ...body, projectId })),
    update: (projectId: string, id: string, body: { name?: string; projectId?: string }) =>
        changed<DesignSystem>(projectId, () => http.patch(dsPath(projectId, `/design-systems/${id}`), body), id),
    remove: (projectId: string, id: string) =>
        changed<void>(projectId, () => http.delete(dsPath(projectId, `/design-systems/${id}`)), id),
    tokens: (projectId: string, id: string) =>
        apiRequest<DesignSystemTokenDefinition[]>(() => http.get(dsPath(projectId, `/design-systems/${id}/tokens`))),
};
