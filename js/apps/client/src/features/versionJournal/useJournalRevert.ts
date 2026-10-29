import { useRef, useState } from 'react';
import type { DraftChangeDto, EditorContextKey } from '../../api/editorContracts';
import { waitForDraftAutosaveIdle } from '../../api/draftAutosaveActivity';
import { versionJournalRepository as repository } from '../../api/versionJournalRepository';
import type { JournalActionViewModel } from './journalPresenter';
import { errorCode } from './useJournal';

const revertError = (cause: unknown) => {
    const code = errorCode(cause);
    if (code === 'DRAFT_CHANGE_STALE') return 'Черновик уже изменился. Журнал обновлён; выберите изменение ещё раз.';
    if (code === 'REVERT_DEPENDENCY_CONFLICT') return 'Изменение нельзя отменить из-за зависимых изменений. Журнал обновлён.';
    return 'Не удалось полностью отменить изменение. Журнал обновлён.';
};

export const useJournalRevert = (
    context: EditorContextKey | undefined,
    onReload: () => Promise<void>,
    refreshChanges?: (changes: DraftChangeDto[]) => Promise<void>,
) => {
    const [operationError, setOperationError] = useState<string>();
    const [reverting, setReverting] = useState<string>();
    const [refreshFailed, setRefreshFailed] = useState(false);
    const pendingRefresh = useRef<JournalActionViewModel>();
    const pendingError = useRef<string>();
    const running = useRef(false);
    const refresh = async (action: JournalActionViewModel) => {
        if (context) await waitForDraftAutosaveIdle(context, 10_000);
        const results = await Promise.allSettled([refreshChanges?.(action.changes), onReload()]);
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
        const attempted: DraftChangeDto[] = [];
        try {
            if (!context) throw new Error('Контекст журнала недоступен');
            for (const change of action.changes) {
                // Ошибка ответа не доказывает отсутствие COMMIT: сверяем и неизвестный результат команды.
                attempted.push(change);
                if (action.revertPaths) await repository.revertChange(context, change, action.revertPaths);
                else await repository.revertChange(context, change);
            }
        } catch (cause) {
            pendingError.current = revertError(cause);
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
