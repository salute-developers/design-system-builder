import { readEditor } from '../../../api/editorReads';
import { invalidateQueryCache } from '../../../shared/data/useLoad';
import { http } from '../../../api/http';
import { apiRequest } from '../../../shared/data/apiRequest';
import type {
    CreatedProjectAccessKey,
    Project,
    ProjectAccessKey,
    ProjectMember,
    ProjectMemberCandidate,
    ProjectRole,
} from '../domain/project';

const projectPath = (suffix = '') => `/api/projects${suffix}`;

const changed = async <T>(operation: () => Promise<{ data: T }>, keys: string[]) => {
    const value = await apiRequest<T>(operation);
    invalidateQueryCache(...keys);
    return value;
};

export const projectsApi = {
    list: (signal?: AbortSignal) => apiRequest<Project[]>(() => readEditor<Project[]>(projectPath(), { signal })),
    get: (id: string, signal?: AbortSignal) =>
        apiRequest<Project>(() => readEditor<Project>(projectPath(`/${id}`), { signal })),
    create: (body: { name: string; description?: string }) =>
        changed<Project>(() => http.post(projectPath(), body), ['projects']),
    update: (id: string, body: { name?: string; description?: string }) =>
        changed<Project>(() => http.patch(projectPath(`/${id}`), body), ['projects', `project:${id}`]),
    archive: (id: string) =>
        changed<Project>(() => http.post(projectPath(`/${id}/archive`)), ['projects', `project:${id}`]),
    restore: (id: string) =>
        changed<Project>(() => http.post(projectPath(`/${id}/restore`)), ['projects', `project:${id}`]),
    members: (id: string, signal?: AbortSignal) =>
        apiRequest<ProjectMember[]>(() => readEditor<ProjectMember[]>(projectPath(`/${id}/members`), { signal })),
    memberCandidates: (query: string) =>
        apiRequest<ProjectMemberCandidate[]>(() => http.get(projectPath('/member-candidates'), { params: { query } })),
    addMember: (id: string, body: { email: string; role: Exclude<ProjectRole, 'owner'> }) =>
        changed<ProjectMember>(() => http.post(projectPath(`/${id}/members`), body), [`members:${id}`]),
    updateMember: (id: string, userId: string, role: Exclude<ProjectRole, 'owner'>) =>
        changed<ProjectMember>(() => http.patch(projectPath(`/${id}/members/${userId}`), { role }), [`members:${id}`]),
    removeMember: (id: string, userId: string) =>
        changed<void>(() => http.delete(projectPath(`/${id}/members/${userId}`)), [`members:${id}`]),
    accessKeys: (id: string) => apiRequest<ProjectAccessKey[]>(() => http.get(projectPath(`/${id}/access-keys`))),
    createAccessKey: (id: string, body: { name: string; scopes: string[]; ttlSeconds?: number }) =>
        apiRequest<CreatedProjectAccessKey>(() => http.post(projectPath(`/${id}/access-keys`), body)),
    revokeAccessKey: (id: string, keyId: string) =>
        apiRequest<ProjectAccessKey>(() => http.delete(projectPath(`/${id}/access-keys/${keyId}`))),
};
