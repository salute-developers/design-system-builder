import { http } from './http';
import { readEditor, invalidateEditorReads } from './editorReads';
import { PROJECTS_URL } from './constants';
import type { ProjectDto, ProjectMemberDto, DesignSystemDto } from './contracts';
import type { EditorContextKey, DesignSystemVersionDto, DraftChangeDto, DraftAddressTarget, DraftTokenTarget,
    DraftTokenTargetsPage } from './editorContracts';
import { isAxiosError } from 'axios';
import { readTokenTargetPages } from './tokenTargetPages';
import { apiRoot, readRequest } from './editorHttp';

const actorLabel = (actor: { userId: string; displayName?: string | null; username?: string | null; email?: string | null }) =>
    actor.displayName || actor.username || actor.email || actor.userId;

/** Предметный клиент с ограниченным набором операций. */
export class VersionJournalRepository {
    async listVersions(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await readEditor<DesignSystemVersionDto[]>(
                `${apiRoot(context.projectId, context.designSystemId)}/versions`,
                { signal },
            )
        ).data;
    }

    async getDesignSystem(context: EditorContextKey, signal?: AbortSignal) {
        return (
            await readEditor<DesignSystemDto>(
                `${apiRoot(context.projectId, context.designSystemId)}`,
                {
                    signal,
                },
            )
        ).data;
    }

    async listChanges(context: EditorContextKey, signal?: AbortSignal, onTotal?: (total: number | undefined) => void) {
        const response = await readEditor<DraftChangeDto[]>(
            `${apiRoot(context.projectId, context.designSystemId)}/changes`,
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
                `${apiRoot(context.projectId, context.designSystemId)}/changes/token-ids`,
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
            labels[project.ownerUserId] = actorLabel({
                userId: project.ownerUserId,
                displayName: project.ownerDisplayName,
                username: project.ownerUsername,
                email: project.ownerEmail,
            });
        }
        if (membersResult.status === 'fulfilled') {
            membersResult.value.data.forEach((member) => {
                labels[member.userId] = actorLabel(member);
            });
        }
        return labels;
    }

    async revertChange(context: EditorContextKey, change: DraftChangeDto, paths?: string[]) {
        if (!paths?.length) return this.revertChanges(context, [change]);
        if (change.parameterRevertSupported !== true) {
            throw new Error('Сервер не подтвердил поддержку отмены отдельных параметров');
        }
        const response = await http.post(
            `${apiRoot(context.projectId, context.designSystemId)}/changes/${change.changeId}/revert`,
            { paths },
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

    /**
     * Откатывает записи [changes] одним запросом и одной транзакцией в переданном порядке (от новой к старой):
     * либо все, либо ни одной. Редакции берутся из одного снимка журнала; не больше 200 записей за запрос.
     */
    async revertChanges(context: EditorContextKey, changes: readonly DraftChangeDto[]) {
        const draftId = changes[0]?.versionId;
        if (!draftId || changes.some((change) => change.versionId !== draftId)) throw new Error('Несогласованный черновик');
        return this.revertAddressed(context, draftId, changes.map((change) => ({
            entityType: change.entityType, entityId: change.entityId, expectedRevision: change.editRevision,
        })));
    }

    async revertAddressed(context: EditorContextKey, draftId: string, targets: readonly DraftAddressTarget[]) {
        if (!targets.length || targets.length > 200 || context.versionId) throw new Error('Некорректный пакет отката');
        const response = await http.post(
            `${apiRoot(context.projectId, context.designSystemId)}/changes/revert-by-address`,
            {
                draftId,
                targets: targets.map(({ entityType, entityId, expectedRevision }) => ({
                    entityType, entityId, expectedRevision,
                })),
            },
            { headers: { 'Idempotency-Key': crypto.randomUUID() } },
        );
        invalidateEditorReads(context);
        return response;
    }

    /** Собирает цели только выбранных токенов; общий журнал не загружается. */
    async listTokenTargets(context: EditorContextKey, tokenIds: ReadonlySet<string>, knownDraftId?: string) {
        if (context.versionId) throw new Error('Опубликованная версия доступна только для чтения');
        const draftId = knownDraftId ?? (await this.getDesignSystem(context)).draftId;
        if (!draftId) throw new Error('Черновик недоступен');
        const ids = [...tokenIds];
        for (let attempt = 0; ; attempt++) {
            const targets: DraftTokenTarget[] = [];
            try {
                for (let start = 0; start < ids.length; start += 200) {
                    const selectedIds = ids.slice(start, start + 200);
                    const pages = await readTokenTargetPages(draftId, async (cursor) => (await readEditor<DraftTokenTargetsPage>(
                        `${apiRoot(context.projectId, context.designSystemId)}/changes/token-targets`, {},
                        { draftId, tenantId: context.tenantId, tokenIds: selectedIds, cursor },
                    )).data);
                    targets.push(...pages);
                }
                return { draftId, targets };
            } catch (cause) {
                if (attempt >= 2 || !isAxiosError(cause) || cause.response?.data?.code !== 'TARGET_SNAPSHOT_CHANGED') throw cause;
            }
        }
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
            `${apiRoot(context.projectId, context.designSystemId)}/versions`,
            { draftId, draftRevision, version, changelog },
            { headers: { 'Idempotency-Key': idempotencyKey } },
        );
        invalidateEditorReads(context);
        return response.data;
    }
}

export const versionJournalRepository = new VersionJournalRepository();
