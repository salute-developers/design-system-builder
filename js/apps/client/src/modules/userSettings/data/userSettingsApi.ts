import { http } from '../../../api/http';
import { apiRequest } from '../../../shared/data/apiRequest';

export interface PersonalAccessToken {
    id: string;
    name: string;
    scopes: string[];
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    lastUsedAt: string | null;
}
export interface TokenScope { id: string; title: string; description: string }
const path = '/api/settings/personal-access-tokens';
export const userSettingsApi = {
    tokens: () => apiRequest<PersonalAccessToken[]>(() => http.get(path)),
    scopes: () => apiRequest<{ scopes: TokenScope[] }>(() => http.get(`${path}/scopes`)),
    create: (body: { name: string; scopes: string[]; ttlSeconds: number }) =>
        apiRequest<{ token: PersonalAccessToken; secret: string }>(() => http.post(path, body)),
    revoke: (id: string) => apiRequest<PersonalAccessToken>(() => http.delete(`${path}/${encodeURIComponent(id)}`)),
};
