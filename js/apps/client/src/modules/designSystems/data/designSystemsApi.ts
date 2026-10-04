import { http } from '../../../api/http';
import { apiRequest } from '../../../shared/data/apiRequest';
import type { DesignSystem } from '../domain/designSystem';

const projectPath = (suffix = '') => `/api/projects${suffix}`;
const dsPath = (projectId: string, suffix: string) => projectPath(`/${projectId}/ds${suffix}`);

export const designSystemsApi = {
    list: (projectId: string) => apiRequest<DesignSystem[]>(() => http.get(dsPath(projectId, '/design-systems'))),
    get: (projectId: string, id: string) =>
        apiRequest<DesignSystem>(() => http.get(dsPath(projectId, `/design-systems/${id}`))),
    create: (projectId: string, body: { name: string; projectName: string; description?: string }) =>
        apiRequest<DesignSystem>(() => http.post(dsPath(projectId, '/design-systems'), { ...body, projectId })),
    update: (projectId: string, id: string, body: { name?: string; projectId?: string }) =>
        apiRequest<DesignSystem>(() => http.patch(dsPath(projectId, `/design-systems/${id}`), body)),
    remove: (projectId: string, id: string) =>
        apiRequest<void>(() => http.delete(dsPath(projectId, `/design-systems/${id}`))),
};
