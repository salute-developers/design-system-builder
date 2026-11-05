import { buildSnapshot, type TokenSnapshot } from '../tokens/snapshot';
import type { HttpClient } from './httpClient';
import type {
    DesignSystemDto,
    DesignSystemVersionDto,
    ProjectDto,
    SizeTokensDto,
    TenantDto,
    TokenDefinitionDto,
    TokenValueDto,
    TypographyStylesDto,
} from './types';

export interface DesignSystemContext {
    projectId: string;
    designSystemId: string;
}

export interface TenantContext extends DesignSystemContext {
    tenantId: string;
}

const COLOR_TYPES = 'color,gradient';

const root = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/ds`;

/** Чтения DS Builder для плагина. Записей в API нет. */
export const createDsBuilderApi = (http: HttpClient) => ({
    projects: (signal?: AbortSignal) => http.get<ProjectDto[]>('/api/projects', { signal }),
    designSystems: (projectId: string, signal?: AbortSignal) =>
        http.get<DesignSystemDto[]>(`${root(projectId)}/design-systems`, { signal }),
    tenants: async ({ projectId, designSystemId }: DesignSystemContext, signal?: AbortSignal) => {
        const tenants = await http.get<TenantDto[]>(`${root(projectId)}/design-systems/${designSystemId}/tenants`, {
            signal,
        });
        return tenants.map((tenant) => ({ ...tenant, name: tenant.name || 'Тема без названия' }));
    },
    versions: ({ projectId, designSystemId }: DesignSystemContext, signal?: AbortSignal) =>
        http.get<DesignSystemVersionDto[]>(
            `${root(projectId)}/design-system-versions/by-design-system/${designSystemId}`,
            {
                signal,
            },
        ),
    /** Определения и значения темы на одной границе: опубликованная версия или, без `versionId`, активный черновик. */
    snapshot: async (
        { projectId, designSystemId, tenantId }: TenantContext,
        versionId: string | null,
        signal?: AbortSignal,
    ): Promise<TokenSnapshot> => {
        const params = { versionId };
        const tenant = `${root(projectId)}/tenants/${tenantId}`;
        const [tokens, values, typography, sizes] = await Promise.all([
            http.get<TokenDefinitionDto[]>(`${root(projectId)}/design-systems/${designSystemId}/tokens`, {
                params,
                signal,
            }),
            http.get<TokenValueDto[]>(`${tenant}/token-values`, { params: { ...params, types: COLOR_TYPES }, signal }),
            http.get<TypographyStylesDto>(`${tenant}/typography-styles`, { params, signal }),
            http.get<SizeTokensDto>(`${tenant}/size-tokens`, { params, signal }),
        ]);
        return buildSnapshot({ tokens, values, typography, sizes });
    },
});

export type DsBuilderApi = ReturnType<typeof createDsBuilderApi>;
