import { readEditor } from './editorReads';
import { PROJECTS_URL } from './constants';
import type { ProjectDto, DesignSystemDto } from './contracts';
import type { EditorContextKey, ThemeEditorSnapshot } from './editorContracts';
import { apiRoot, readRequest } from './editorHttp';
import { tokenRepository } from './tokenRepository';
import { componentRepository } from './componentRepository';

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
