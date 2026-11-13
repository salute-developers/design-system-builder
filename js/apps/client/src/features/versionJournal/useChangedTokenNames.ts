import { useEffect, useMemo, useState } from 'react';
import type { EditorContextKey, TokenDefinitionDto } from '../../api/editorContracts';
import { reloadWhenDraftAutosaveIsIdle } from '../../api/draftAutosaveActivity';
import { versionJournalRepository } from '../../api/versionJournalRepository';

/** Автосохранение не публикует токен: отметка живёт до публикации или отмены изменения. */
export function useChangedTokenNames(
    context: EditorContextKey | undefined,
    definitions: TokenDefinitionDto[],
    refreshKey: unknown,
    enabled: boolean,
) {
    const key = JSON.stringify(context ?? null);
    const [state, setState] = useState<{ key: string; ids: Set<string> }>();
    useEffect(() => {
        if (!context || context.versionId || !enabled) return;
        const controller = new AbortController();
        const cancel = reloadWhenDraftAutosaveIsIdle(context, () => {
            if (controller.signal.aborted) return;
            void versionJournalRepository
                .listChangedTokenIds(context, controller.signal)
                .then((ids) => {
                    if (!controller.signal.aborted) setState({ key, ids: new Set(ids) });
                })
                .catch(() => {
                    /* Сохраняем последнюю подтверждённую отметку при временной ошибке чтения. */
                });
        });
        return () => {
            cancel();
            controller.abort();
        };
    }, [key, refreshKey, enabled]);
    return useMemo(
        () =>
            !context?.versionId && state?.key === key
                ? new Set(definitions.filter((token) => state.ids.has(token.id)).map((token) => token.name))
                : undefined,
        [context?.versionId, key, state, definitions],
    );
}
