import { readEditor } from '../../../api/editorReads';
import { invalidateQueryCache } from '../../../shared/data/useLoad';
import { http } from '../../../api/http';
import { apiRequest } from '../../../shared/data/apiRequest';
import type { ThemeTenant } from '../domain/theme';

/** Значение темы в форме `values` создания темы и пакета `PUT tenants/{id}/token-values`. */
export interface TenantTokenValueInput {
    tokenId: string;
    platform: 'web' | 'ios' | 'android';
    mode: 'light' | 'dark' | null;
    paletteId: null;
    value: unknown;
}

const projectPath = (suffix = '') => `/api/projects${suffix}`;
const dsPath = (projectId: string, designSystemId: string, suffix: string) =>
    projectPath(`/${projectId}/design-systems/${designSystemId}${suffix}`);

const changed = async (projectId: string, operation: () => Promise<{ data: ThemeTenant }>) => {
    const value = await apiRequest<ThemeTenant>(operation);
    invalidateQueryCache(
        `themes:${projectId}:${value.designSystemId}`,
        `system:${projectId}:${value.designSystemId}`,
        `systems:${projectId}`,
    );
    return value;
};

export const themesApi = {
    list: (projectId: string, designSystemId: string, signal?: AbortSignal) =>
        apiRequest<ThemeTenant[]>(() =>
            readEditor<ThemeTenant[]>(
                dsPath(projectId, designSystemId, "/tenants"),
                { signal },
                undefined,
                30_000,
            ),
        ),
    create: (projectId: string, body: Record<string, unknown> & { designSystemId: string }) => {
        const { designSystemId, ...data } = body;
        return changed(projectId, () => http.post(dsPath(projectId, designSystemId, '/tenants'), data));
    },
    update: (projectId: string, id: string, body: { name: string }, designSystemId: string) =>
        changed(projectId, () => http.patch(dsPath(projectId, designSystemId, `/tenants/${id}`), body)),
    remove: async (projectId: string, id: string, designSystemId: string) => {
        await apiRequest<void>(() => http.delete(dsPath(projectId, designSystemId, `/tenants/${id}`)));
        invalidateQueryCache(
            `themes:${projectId}:${designSystemId}`,
            `system:${projectId}:${designSystemId}`,
            `systems:${projectId}`,
        );
    },
};
