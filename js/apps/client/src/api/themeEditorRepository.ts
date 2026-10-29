import { readEditor } from './editorReads';
import { PROJECTS_URL } from './constants';
import type { ProjectDto, DesignSystemDto, TenantDto } from './contracts';
import type {
    EditorContextKey,
    ThemeEditorSnapshot,
    DesignSystemComponentDto,
    DesignSystemVersionDto,
} from './editorContracts';
import { apiRoot, readRequest } from './editorHttp';
import { tokenRepository } from './tokenRepository';
import { componentRepository } from './componentRepository';
import type { ThemeSource } from '../controllers/designSystem';

/** Оболочка не читает значения токенов, палитру, компоненты и историю. */
export async function loadThemeShell(context: EditorContextKey, signal?: AbortSignal): Promise<ThemeEditorSnapshot> {
    const root = apiRoot(context.projectId);
    const request = readRequest(context, signal);
    const [project, designSystem, tenant, links, version] = await Promise.all([
        readEditor<ProjectDto>(`${PROJECTS_URL}/${context.projectId}`, { signal }),
        readEditor<DesignSystemDto>(`${root}/design-systems/${context.designSystemId}`, request),
        readEditor<TenantDto>(`${root}/tenants/${context.tenantId}`, request),
        readEditor<DesignSystemComponentDto[]>(`${root}/design-system-components`, request),
        context.versionId
            ? readEditor<DesignSystemVersionDto>(`${root}/design-system-versions/${context.versionId}`, request)
            : Promise.resolve(undefined),
    ]);
    if (tenant.data.designSystemId !== context.designSystemId) throw new Error('TENANT_DESIGN_SYSTEM_MISMATCH');
    if (version && version.data.designSystemId !== context.designSystemId) throw new Error('VERSION_DESIGN_SYSTEM_MISMATCH');
    const types = ['color', 'gradient', 'typography', 'fontFamily', 'shape', 'spacing', 'shadow'];
    const empty = {
        mode: [],
        category: [],
        subcategory: [],
        direction: [],
        kind: [],
        size: [],
        screen: [],
        weight: [],
    };
    const themeData = {
        meta: {
            name: tenant.data.name,
            version: version?.data.version ?? '0.1.0',
            tokens: [],
            ...Object.fromEntries(types.map((type) => [type, empty])),
        },
        variations: Object.fromEntries(types.map((type) => [type, { web: {}, ios: {}, android: {} }])),
    } as unknown as ThemeSource;
    return {
        tenant: tenant.data,
        designSystem: designSystem.data,
        themeData,
        editRevision: tenant.data.editRevision,
        incompleteTokenIds: [],
        tokenIdsByName: {},
        tokenDefinitionsByName: {},
        tokenValueRevisionsByKey: {},
        tokenValueEntityIdsByKey: {},
        publicationVersion: version?.data.version ?? '0.1.0',
        componentsData: [],
        composeComponentsData: [],
        hasComponents: links.data.some((link) => link.designSystemId === context.designSystemId),
        parameters: {
            projectId: context.projectId,
            projectName: project.data.name,
            packagesName: designSystem.data.name,
            tenantId: context.tenantId,
            designSystemId: context.designSystemId,
            effectiveRole: project.data.effectiveRole,
            editRevision: tenant.data.editRevision,
            draftId: designSystem.data.draftId ?? undefined,
            draftRevision: designSystem.data.draftRevision ?? undefined,
            readOnly:
                Boolean(context.versionId) ||
                project.data.status === 'archived' ||
                project.data.effectiveRole === 'viewer',
        },
    };
}

export type * from './editorContracts';

/** Получает курсор подтверждённого состояния чтением, независимо от идентичности SSE-события. */
export async function loadDesignSystemCursor(context: EditorContextKey, signal?: AbortSignal) {
    return (
        await readEditor<DesignSystemDto>(
            `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}`,
            readRequest(context, signal),
        )
    ).data;
}

/** Первичная загрузка редактора объединяет независимые предметные данные. */
export async function loadThemeEditor(context: EditorContextKey, signal?: AbortSignal): Promise<ThemeEditorSnapshot> {
    const root = apiRoot(context.projectId);
    const request = readRequest(context, signal);
    const [project, designSystem, tokenData, components, composeComponentsData] = await Promise.all([
        readEditor<ProjectDto>(`${PROJECTS_URL}/${context.projectId}`, { signal }),
        readEditor<DesignSystemDto>(`${root}/design-systems/${context.designSystemId}`, request),
        tokenRepository.loadTokenData(context, signal),
        componentRepository.loadComponentData(context, signal),
        componentRepository.loadComposeComponentData(context, signal),
    ]);
    return {
        ...tokenData,
        designSystem: designSystem.data,
        componentsData: components,
        composeComponentsData,
        parameters: {
            projectId: context.projectId,
            projectName: project.data.name,
            packagesName: designSystem.data.name,
            tenantId: context.tenantId,
            designSystemId: context.designSystemId,
            effectiveRole: project.data.effectiveRole,
            editRevision: tokenData.tenant.editRevision,
            draftId: designSystem.data.draftId ?? undefined,
            draftRevision: designSystem.data.draftRevision ?? undefined,
            readOnly: [
                Boolean(context.versionId),
                project.data.status === 'archived',
                project.data.effectiveRole === 'viewer',
            ].some(Boolean),
        },
    };
}
