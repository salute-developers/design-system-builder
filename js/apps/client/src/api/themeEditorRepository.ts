import { readEditor } from './editorReads';
import { getDsReadBoundary } from './dsReadBoundary';
import { PROJECTS_URL } from './constants';
import type { ProjectDto, DesignSystemDto, TenantDto } from './contracts';
import type {
    EditorContextKey,
    ThemeEditorSnapshot,
    DesignSystemComponentDto,
    DesignSystemVersionDto,
    AppearanceDto,
} from './editorContracts';
import { apiRoot, readRequest } from './editorHttp';
import { tokenRepository } from './tokenRepository';
import { componentRepository } from './componentRepository';
import type { ThemeSource } from '../controllers/designSystem';

/** Оболочка не читает значения токенов, палитру, компоненты и историю. */
export async function loadThemeShell(context: EditorContextKey, signal?: AbortSignal): Promise<ThemeEditorSnapshot> {
    const root = apiRoot(context.projectId, context.designSystemId);
    const request = readRequest(context, signal);
    const designSystem = await readEditor<DesignSystemDto>(`${root}`, request);
    const boundary = getDsReadBoundary(context.projectId, context.designSystemId);
    const publicRead = boundary?.accessMode === 'public';
    const [project, tenant, links, version] = await Promise.all([
        publicRead
            ? Promise.resolve(undefined)
            : readEditor<ProjectDto>(`${PROJECTS_URL}/${context.projectId}`, { signal }),
        readEditor<TenantDto>(`${root}/tenants/${context.tenantId}`, request),
        readEditor<DesignSystemComponentDto[]>(`${root}/design-system-components`, request),
        context.versionId
            ? readEditor<DesignSystemVersionDto>(`${root}/versions/${context.versionId}`, { signal })
            : Promise.resolve(undefined),
    ]);
    if (tenant.data.designSystemId !== context.designSystemId) throw new Error('TENANT_DESIGN_SYSTEM_MISMATCH');
    // Раздел компонентов доступен, когда все компоненты скрыты (у скрытых остаются оформления) и когда их нет совсем,
    // но есть шаблоны: добавить и вернуть компоненты можно только из раздела. Дополнительные чтения — лишь без связей.
    const hasComponents =
        links.data.some((link) => link.designSystemId === context.designSystemId) ||
        (await readEditor<AppearanceDto[]>(`${root}/appearances`, request)).data.length > 0 ||
        (!publicRead && (await componentRepository.loadComponentTemplates(context, signal)).length > 0);
    if (version && version.data.designSystemId !== context.designSystemId)
        throw new Error('VERSION_DESIGN_SYSTEM_MISMATCH');
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
    const publicationVersion = version?.data.version ?? boundary?.version ?? '0.1.0';
    const themeData = {
        meta: {
            name: tenant.data.name,
            version: publicationVersion,
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
        publicationVersion,
        componentsData: [],
        composeComponentsData: [],
        hasComponents,
        parameters: themeParameters(context, designSystem.data, tenant.data.editRevision, project?.data),
    };
}

export type * from './editorContracts';

/** Получает курсор подтверждённого состояния чтением, независимо от идентичности SSE-события. */
export async function loadDesignSystemCursor(context: EditorContextKey, signal?: AbortSignal) {
    return (
        await readEditor<DesignSystemDto>(
            `${apiRoot(context.projectId, context.designSystemId)}`,
            readRequest(context, signal),
        )
    ).data;
}

/** Первичная загрузка редактора объединяет независимые предметные данные. */
export async function loadThemeEditor(context: EditorContextKey, signal?: AbortSignal): Promise<ThemeEditorSnapshot> {
    const root = apiRoot(context.projectId, context.designSystemId);
    const request = readRequest(context, signal);
    const designSystem = await readEditor<DesignSystemDto>(`${root}`, request);
    const boundary = getDsReadBoundary(context.projectId, context.designSystemId);
    const publicRead = boundary?.accessMode === 'public';
    const [project, tokenData, components, composeComponentsData] = await Promise.all([
        publicRead
            ? Promise.resolve(undefined)
            : readEditor<ProjectDto>(`${PROJECTS_URL}/${context.projectId}`, { signal }),
        tokenRepository.loadTokenData(context, signal),
        componentRepository.loadComponentData(context, signal),
        componentRepository.loadComposeComponentData(context, signal),
    ]);
    return {
        ...tokenData,
        designSystem: designSystem.data,
        componentsData: components,
        composeComponentsData,
        parameters: themeParameters(context, designSystem.data, tokenData.tenant.editRevision, project?.data),
    };
}

/** Единые параметры снимка для полной и отложенной загрузки редактора. */
const themeParameters = (
    context: EditorContextKey,
    system: DesignSystemDto,
    editRevision: number,
    project?: ProjectDto,
): ThemeEditorSnapshot['parameters'] => {
    const effectiveRole = project?.effectiveRole ?? 'viewer';
    return {
        projectId: context.projectId,
        projectName: project?.name ?? system.projectName ?? '',
        packagesName: system.name,
        tenantId: context.tenantId,
        designSystemId: context.designSystemId,
        effectiveRole,
        editRevision,
        draftId: system.draftId ?? undefined,
        draftRevision: system.draftRevision ?? undefined,
        readOnly: [
            Boolean(context.versionId),
            Boolean(getDsReadBoundary(context.projectId, context.designSystemId)?.versionId),
            project?.status === 'archived',
            effectiveRole === 'viewer',
        ].some(Boolean),
    };
};
