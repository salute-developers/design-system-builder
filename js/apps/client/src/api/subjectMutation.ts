import type { EditorContextKey } from './editorContracts';
import { invalidateEditorReads } from './editorReads';
import { recordDraftSave, setDraftAutosaveActivity } from './draftAutosaveActivity';
import { parseMutationMetadata } from './editorHttp';
import { observeSubjectRevisions, acceptSubjectAddress } from './subjectRevisions';
import { authService } from './authService';

const activeRequests = new Map<string, { count: number }>();
let sessionGeneration = 0;
authService.onSessionReset(() => {
    sessionGeneration += 1;
    activeRequests.clear();
});

/** Технические заголовки предметной операции; ключ создаётся один раз для отправляемого запроса. */
export const subjectMutationHeaders = (baseRevision = 0, idempotencyKey = crypto.randomUUID()) => ({
    'X-DS-Base-Revision': String(baseRevision),
    'Idempotency-Key': idempotencyKey,
});

/** Учитывает выполняющиеся команды, но не подменяет очередь неподтверждённых пользовательских правок. */
export async function subjectMutation<T>(
    context: EditorContextKey,
    operation: () => Promise<T>,
    subject?: { address: string; entityType: string },
): Promise<T> {
    if (context.versionId) throw new Error('Опубликованная версия доступна только для чтения');
    const generation = sessionGeneration;
    const key = `${context.projectId}:${context.designSystemId}:${context.tenantId}`;
    const activity = activeRequests.get(key) ?? { count: 0 };
    activity.count += 1;
    activeRequests.set(key, activity);
    setDraftAutosaveActivity(context, 'subject-requests', 'saving');
    try {
        const result = await operation();
        if (generation !== sessionGeneration) throw new Error('Сессия редактора завершена');
        if (result && typeof result === 'object' && 'headers' in result) {
            const headers = result.headers as Record<string, unknown> | undefined;
            const metadata = parseMutationMetadata(headers?.['x-ds-mutation-metadata']);
            observeSubjectRevisions(context, metadata);
            const primary = metadata.filter((item) => item.entityType === subject?.entityType);
            if (subject && primary.length === 1) acceptSubjectAddress(context, subject.address, primary[0].revision);
        }
        invalidateEditorReads();
        recordDraftSave(context);
        return result;
    } finally {
        activity.count -= 1;
        if (!activity.count && generation === sessionGeneration) {
            activeRequests.delete(key);
            // Команда завершена, ошибку показывает её вызывающий экран. Если правка остаётся
            // неподтверждённой, состоянием error и повтором владеет предметная очередь автосохранения.
            setDraftAutosaveActivity(context, 'subject-requests', null);
        }
    }
}
