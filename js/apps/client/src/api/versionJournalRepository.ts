import { http } from './http';
import { readEditor, invalidateEditorReads } from './editorReads';
import { PROJECTS_URL } from './constants';
import type { ProjectDto, ProjectMemberDto, DesignSystemDto } from './contracts';
import type { EditorContextKey, DesignSystemVersionDto, DraftChangeDto } from './editorContracts';
import { apiRoot, readRequest } from './editorHttp';

/** Предметный клиент с ограниченным набором операций. */
export class VersionJournalRepository {
    async listVersions(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await readEditor<DesignSystemVersionDto[]>(
                `${apiRoot(context.projectId)}/design-system-versions/by-design-system/${context.designSystemId}`,
                { signal },
            )
        ).data;
    }

    async getDesignSystem(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await readEditor<DesignSystemDto>(
                `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}`,
                {
                    signal,
                },
            )
        ).data;
    }

    async listChanges(context: EditorContextKey, signal?: AbortSignal, onTotal?: (total: number | undefined) => void) {
        const response = await readEditor<DraftChangeDto[]>(
            `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}/changes`,
            readRequest(context, signal),
        );
        const raw = response.headers?.['x-ds-journal-total'];
        const total = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : undefined;
        onTotal?.(Number.isSafeInteger(total) ? total : undefined);
        return response.data;
    }

    async listChangedTokenIds(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await readEditor<{ tokenIds: string[] }>(
                `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}/changes/token-ids`,
                {
                    ...readRequest(context, signal),
                    params: { ...readRequest(context).params, tenantId: context.tenantId },
                },
            )
        ).data.tokenIds;
    }

    async listProjectActorLabels(projectId: string, signal?: AbortSignal) {
        const [projectResult, membersResult] = await Promise.allSettled([
            readEditor<ProjectDto>(`${PROJECTS_URL}/${projectId}`, { signal }),
            readEditor<ProjectMemberDto[]>(`${PROJECTS_URL}/${projectId}/members`, { signal }),
        ]);
        const labels: Record<string, string> = {};
        if (projectResult.status === 'fulfilled') {
            const project = projectResult.value.data;
            labels[project.ownerUserId] =
                project.ownerDisplayName || project.ownerUsername || project.ownerEmail || project.ownerUserId;
        }
        if (membersResult.status === 'fulfilled') {
            membersResult.value.data.forEach((member) => {
                labels[member.userId] = member.displayName || member.username || member.email || member.userId;
            });
        }
        return labels;
    }

    async revertChange(context: EditorContextKey, change: DraftChangeDto, paths?: string[]) {
        if (paths?.length && change.parameterRevertSupported !== true) {
            throw new Error('Сервер не подтвердил поддержку отмены отдельных параметров');
        }
        const response = await http.post(
            `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}/changes/${change.changeId}/revert`,
            paths?.length ? { paths } : {},
            {
                headers: {
                    'X-DS-Base-Revision': String(change.editRevision),
                    'Idempotency-Key': crypto.randomUUID(),
                },
            },
        );
        invalidateEditorReads(context);
        return response;
    }

    async publish(
        context: EditorContextKey,
        draftId: string,
        draftRevision: number,
        version: string,
        changelog: string,
        idempotencyKey: string,
    ) {
        const response = await http.post<DesignSystemVersionDto>(
            `${apiRoot(context.projectId)}/design-system-versions`,
            { designSystemId: context.designSystemId, draftId, draftRevision, version, changelog },
            { headers: { 'Idempotency-Key': idempotencyKey } },
        );
        invalidateEditorReads(context);
        return response.data;
    }
}

export const versionJournalRepository = new VersionJournalRepository();
