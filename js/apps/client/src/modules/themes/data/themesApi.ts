import { http } from '../../../api/http';
import { apiRequest } from '../../../shared/data/apiRequest';
import type { ThemeTenant } from '../domain/theme';

const projectPath = (suffix = '') => `/api/projects${suffix}`;
const dsPath = (projectId: string, suffix: string) => projectPath(`/${projectId}/ds${suffix}`);

export const themesApi = {
    list: (projectId: string, designSystemId: string) =>
        apiRequest<ThemeTenant[]>(() => http.get(dsPath(projectId, `/design-systems/${designSystemId}/tenants`))),
    create: (projectId: string, body: Record<string, unknown>) =>
        apiRequest<ThemeTenant>(() => http.post(dsPath(projectId, '/tenants'), body)),
    update: (projectId: string, id: string, body: { name: string }) =>
        apiRequest<ThemeTenant>(() => http.patch(dsPath(projectId, `/tenants/${id}`), body)),
    remove: (projectId: string, id: string) => apiRequest<void>(() => http.delete(dsPath(projectId, `/tenants/${id}`))),
};
