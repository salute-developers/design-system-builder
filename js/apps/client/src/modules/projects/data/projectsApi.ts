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

export const projectsApi = {
    list: () => apiRequest<Project[]>(() => http.get(projectPath())),
    get: (id: string) => apiRequest<Project>(() => http.get(projectPath(`/${id}`))),
    create: (body: { name: string; description?: string }) => apiRequest<Project>(() => http.post(projectPath(), body)),
    update: (id: string, body: { name?: string; description?: string }) =>
        apiRequest<Project>(() => http.patch(projectPath(`/${id}`), body)),
    archive: (id: string) => apiRequest<Project>(() => http.post(projectPath(`/${id}/archive`))),
    restore: (id: string) => apiRequest<Project>(() => http.post(projectPath(`/${id}/restore`))),
    members: (id: string) => apiRequest<ProjectMember[]>(() => http.get(projectPath(`/${id}/members`))),
    memberCandidates: (query: string) =>
        apiRequest<ProjectMemberCandidate[]>(() => http.get(projectPath('/member-candidates'), { params: { query } })),
    addMember: (id: string, body: { email: string; role: Exclude<ProjectRole, 'owner'> }) =>
        apiRequest<ProjectMember>(() => http.post(projectPath(`/${id}/members`), body)),
    updateMember: (id: string, userId: string, role: Exclude<ProjectRole, 'owner'>) =>
        apiRequest<ProjectMember>(() => http.patch(projectPath(`/${id}/members/${userId}`), { role })),
    removeMember: (id: string, userId: string) =>
        apiRequest<void>(() => http.delete(projectPath(`/${id}/members/${userId}`))),
    accessKeys: (id: string) => apiRequest<ProjectAccessKey[]>(() => http.get(projectPath(`/${id}/access-keys`))),
    createAccessKey: (id: string, body: { name: string; scopes: string[]; ttlSeconds?: number }) =>
        apiRequest<CreatedProjectAccessKey>(() => http.post(projectPath(`/${id}/access-keys`), body)),
    revokeAccessKey: (id: string, keyId: string) =>
        apiRequest<ProjectAccessKey>(() => http.delete(projectPath(`/${id}/access-keys/${keyId}`))),
};
