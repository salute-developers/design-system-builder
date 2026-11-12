import { useRef, useState } from 'react';
import type { DraftTokenTarget, DraftRefreshChange, EditorContextKey } from '../../api/editorContracts';
import { waitForDraftAutosaveIdle } from '../../api/draftAutosaveActivity';
import { versionJournalRepository as repository } from '../../api/versionJournalRepository';

/** Сброс невозможен без потери данных: текст ошибки показывается пользователю как есть. */
export class TokenResetError extends Error {}

const CREATED_IN_DRAFT = 'Токен создан в этом черновике: отменить его можно только удалением токена.';
const RESET_FAILED = 'Не удалось сбросить изменения токена.';

/** Предел записей одного пакетного отката на сервере. */
const REVERT_BATCH_LIMIT = 200;

/**
 * Откатывает изменения токенов [tokenIds] в черновике темы пакетным откатом журнала: от новой записи к старой, одним
 * запросом и одной транзакцией — либо все записи, либо ни одной. Возвращает число отменённых записей. Больше
 * [REVERT_BATCH_LIMIT] записей уходит несколькими пакетами, атомарен каждый пакет. Токен, созданный в черновике,
 * не откатывается: откат его записи удалил бы токен во всех темах.
 */
export const resetTokenChanges = async (
    context: EditorContextKey,
    tokenIds: ReadonlySet<string>,
    onAttempt?: (changes: DraftTokenTarget[]) => void,
    draftId?: string,
) => {
    if (!tokenIds.size) return 0;
    await waitForDraftAutosaveIdle(context, 10_000);
    const selected = await repository.listTokenTargets(context, tokenIds, draftId);
    const changes = selected.targets;
    if (changes.some((change) => change.entityType === 'token' && change.operation === 'created'))
        throw new TokenResetError(CREATED_IN_DRAFT);
    for (let start = 0; start < changes.length; start += REVERT_BATCH_LIMIT) {
        const batch = changes.slice(start, start + REVERT_BATCH_LIMIT);
        // Потерянный ответ не доказывает отсутствие COMMIT: обновляем и неизвестный результат попытки.
        onAttempt?.(batch);
        await repository.revertAddressed(context, selected.draftId, batch);
    }
    return changes.length;
};

/** Сброс изменений токена из инспектора: после отката экран перечитывает данные через [onDone]. */
export const useTokenReset = (
    context: EditorContextKey | undefined,
    onDone: (changes: DraftRefreshChange[]) => Promise<void> | void,
    draftId?: string,
    onDiscoveryFailure?: () => Promise<void> | void,
) => {
    const [busy, setBusy] = useState(false);
    const running = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const reset = async (tokenIds: ReadonlySet<string>) => {
        if (!context || context.versionId || running.current) return;
        running.current = true;
        setBusy(true);
        setError(null);
        const attempted: DraftTokenTarget[] = [];
        let discoveryFailed = false;
        try {
            await resetTokenChanges(context, tokenIds, (batch) => attempted.push(...batch), draftId);
        } catch (cause) {
            discoveryFailed = !attempted.length && !(cause instanceof TokenResetError);
            setError(cause instanceof TokenResetError ? cause.message : RESET_FAILED);
        } finally {
            try {
                if (discoveryFailed && onDiscoveryFailure) await onDiscoveryFailure();
                else await onDone(attempted);
            } catch {
                setError('Не удалось обновить данные после сброса. Повторите загрузку данных.');
            } finally {
                running.current = false;
                setBusy(false);
            }
        }
    };
    return { reset, busy, error };
};
