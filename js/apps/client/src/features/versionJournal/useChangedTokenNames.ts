import { useEffect, useState } from 'react';
import type { EditorContextKey, TokenDefinitionDto } from '../../api/editorContracts';
import { versionJournalRepository } from '../../api/versionJournalRepository';

/** Автосохранение не публикует токен: отметка живёт до публикации или отмены изменения. */
export function useChangedTokenNames(
    context: EditorContextKey | undefined,
    definitions: TokenDefinitionDto[],
    refreshKey: unknown,
    enabled: boolean,
) {
    const key = JSON.stringify(context ?? null);
    const [state, setState] = useState<{ key: string; names: Set<string> }>();
    useEffect(() => {
        if (!context || context.versionId || !enabled) return;
        const controller = new AbortController();
        void versionJournalRepository
            .listChanges(context, controller.signal)
            .then((changes) => {
                if (controller.signal.aborted) return;
                const ids = new Set(
                    changes.flatMap((change) => {
                        if (change.entityType === 'token') return [change.entityId];
                        if (change.entityType !== 'token-value') return [];
                        const value = change.currentValue ?? change.previousValue;
                        const tenantId = value?.tenant_id ?? value?.tenantId;
                        if (tenantId && tenantId !== context.tenantId) return [];
                        const id = value?.token_id ?? value?.tokenId;
                        return typeof id === 'string' ? [id] : [];
                    }),
                );
                setState({
                    key,
                    names: new Set(definitions.filter((token) => ids.has(token.id)).map((token) => token.name)),
                });
            })
            .catch(() => {
                /* Сохраняем последнюю подтверждённую отметку при временной ошибке чтения. */
            });
        return () => controller.abort();
    }, [key, definitions, refreshKey, enabled]);
    return !context?.versionId && state?.key === key ? state.names : undefined;
}
