import { useState } from 'react';
import type { DraftChangeDto, EditorContextKey } from '../../api/editorContracts';
import { waitForDraftAutosaveIdle } from '../../api/draftAutosaveActivity';
import { versionJournalRepository as repository } from '../../api/versionJournalRepository';

/** Токен, к которому относится запись журнала: определение токена или его значение в этой теме; иначе `null`. */
export const changedTokenId = (change: DraftChangeDto, tenantId: string): string | null => {
    if (change.entityType === 'token') return change.entityId;
    if (change.entityType !== 'token-value') return null;
    const value = change.currentValue ?? change.previousValue;
    const tenant = value?.tenant_id ?? value?.tenantId;
    if (tenant && tenant !== tenantId) return null;
    const id = value?.token_id ?? value?.tokenId;
    return typeof id === 'string' ? id : null;
};

/** Сброс невозможен без потери данных: текст ошибки показывается пользователю как есть. */
export class TokenResetError extends Error {}

const CREATED_IN_DRAFT = 'Токен создан в этом черновике: отменить его можно только удалением токена.';
const RESET_FAILED = 'Не удалось сбросить изменения токена. Данные обновлены.';

/**
 * Откатывает изменения токенов [tokenIds] в черновике темы теми же операциями, что журнал: от новой записи к
 * старой. Возвращает число отменённых записей. Токен, созданный в черновике, не откатывается: откат его записи
 * удалил бы токен во всех темах, а значения других тем помешали бы откату на полпути.
 */
export const resetTokenChanges = async (context: EditorContextKey, tokenIds: ReadonlySet<string>) => {
    await waitForDraftAutosaveIdle(context, 10_000);
    const changes = (await repository.listChanges(context))
        .filter((change) => tokenIds.has(changedTokenId(change, context.tenantId) ?? ''))
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
    if (changes.some((change) => change.entityType === 'token' && change.operation === 'created'))
        throw new TokenResetError(CREATED_IN_DRAFT);
    for (const change of changes) await repository.revertChange(context, change);
    return changes.length;
};

/** Сброс изменений токена из инспектора: после отката экран перечитывает данные через [onDone]. */
export const useTokenReset = (context: EditorContextKey | undefined, onDone: () => Promise<void> | void) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const reset = async (tokenIds: ReadonlySet<string>) => {
        if (!context || context.versionId || busy) return;
        setBusy(true);
        setError(null);
        try {
            await resetTokenChanges(context, tokenIds);
        } catch (cause) {
            setError(cause instanceof TokenResetError ? cause.message : RESET_FAILED);
        } finally {
            await onDone();
            setBusy(false);
        }
    };
    return { reset, busy, error };
};
