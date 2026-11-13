import type { DraftRefreshOptions } from '../../api/editorContracts';
import { useRef, useState } from 'react';
import type { DraftChangeDto, EditorContextKey } from '../../api/editorContracts';
import { waitForDraftAutosaveIdle } from '../../api/draftAutosaveActivity';
import { versionJournalRepository as repository } from '../../api/versionJournalRepository';
import type { JournalActionViewModel } from './journalPresenter';
import { errorCode } from './useJournal';

const revertErrors: Record<string, string> = {
    DRAFT_CHANGE_STALE: 'Черновик уже изменился. Журнал обновлён; выберите изменение ещё раз.',
    REVERT_DEPENDENCY_CONFLICT: 'Изменение нельзя отменить из-за зависимых изменений. Журнал обновлён.',
};
const revertError = (cause: unknown) =>
    revertErrors[errorCode(cause) ?? ''] ?? 'Не удалось полностью отменить изменение. Журнал обновлён.';

export const useJournalRevert = (
    context: EditorContextKey | undefined,
    onReload: () => Promise<void>,
    refreshChanges?: (changes: DraftChangeDto[], options?: DraftRefreshOptions) => Promise<void>,
) => {
    const [operationError, setOperationError] = useState<string>();
    const [reverting, setReverting] = useState<string>();
    const [refreshFailed, setRefreshFailed] = useState(false);
    const pendingRefresh = useRef<JournalActionViewModel>();
    const pendingError = useRef<string>();
    const running = useRef(false);
    const unknownOutcome = useRef(false);
    const refresh = async (action: JournalActionViewModel) => {
        if (context) await waitForDraftAutosaveIdle(context, 10_000);
        const results = await Promise.allSettled([
            unknownOutcome.current
                ? refreshChanges?.(action.changes, { outcome: 'unknown' })
                : refreshChanges?.(action.changes),
            onReload(),
        ]);
        const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failed) throw failed.reason;
        setRefreshFailed(false);
    };
    const refreshError = () => {
        setRefreshFailed(true);
        setOperationError(
            pendingError.current
                ? 'Не удалось полностью отменить изменение и обновить данные редактора. Повторите загрузку данных.'
                : 'Изменение отменено, но данные редактора не обновлены. Повторите загрузку данных.',
        );
    };
    const revert = async (action: JournalActionViewModel) => {
        if (!action.canRevert || running.current || refreshFailed) return;
        running.current = true;
        setReverting(action.key);
        setOperationError(undefined);
        pendingError.current = undefined;
        unknownOutcome.current = false;
        const attempted: DraftChangeDto[] = [];
        try {
            if (!context) throw new Error('Контекст журнала недоступен');
            if (action.revertPaths) {
                for (const change of action.changes) {
                    attempted.push(change);
                    await repository.revertChange(context, change, action.revertPaths);
                }
            } else {
                for (let start = 0; start < action.changes.length; start += 200) {
                    const batch = action.changes.slice(start, start + 200);
                    // Ошибка ответа не доказывает отсутствие COMMIT: сверяем и неизвестную попытку.
                    attempted.push(...batch);
                    await repository.revertChanges(context, batch);
                }
            }
        } catch (cause) {
            pendingError.current = revertError(cause);
            unknownOutcome.current = attempted.length > 0;
        }
        pendingRefresh.current = { ...action, changes: attempted };
        try {
            await refresh(pendingRefresh.current);
            setOperationError(pendingError.current);
        } catch {
            refreshError();
        } finally {
            running.current = false;
            setReverting(undefined);
        }
    };
    const retryRefresh = async () => {
        const action = pendingRefresh.current;
        if (!action || running.current) return;
        running.current = true;
        setReverting(action.key);
        try {
            await refresh(action);
            setOperationError(pendingError.current);
        } catch {
            refreshError();
        } finally {
            running.current = false;
            setReverting(undefined);
        }
    };
    return { revert, reverting, operationError, refreshFailed, retryRefresh };
};
