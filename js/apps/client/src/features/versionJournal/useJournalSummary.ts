import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorContextKey } from '../../api/editorContracts';
import { apiRoot, readRequest } from '../../api/editorHttp';
import { readEditor } from '../../api/editorReads';

/** Счётчик оболочки не загружает записи, значения и справочники полного журнала. */
export function useJournalSummary(context: EditorContextKey | undefined, refreshKey: unknown, enabled: boolean) {
    const key = JSON.stringify(context ?? null);
    const [state, setState] = useState<{ key: string; total: number; error?: boolean }>();
    const controller = useRef<AbortController>();
    const reload = useCallback(async () => {
        controller.current?.abort();
        if (!context || !enabled) return;
        const current = new AbortController();
        controller.current = current;
        try {
            const result = await readEditor<{ total: number }>(
                `${apiRoot(context.projectId)}/design-systems/${context.designSystemId}/changes/summary`,
                readRequest(context, current.signal),
            );
            if (!current.signal.aborted) setState({ key, total: result.data.total });
        } catch {
            if (!current.signal.aborted) setState({ key, total: 0, error: true });
        }
    }, [key, enabled]);
    useEffect(() => {
        void reload();
        return () => controller.current?.abort();
    }, [reload, refreshKey]);
    return { total: state?.key === key ? state.total : 0, error: state?.key === key ? state.error : undefined, reload };
}
