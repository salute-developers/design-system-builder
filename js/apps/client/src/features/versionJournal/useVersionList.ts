import { useCallback, useEffect, useRef, useState } from 'react';
import type { DesignSystemVersionDto, EditorContextKey } from '../../api/editorContracts';
import { versionJournalRepository } from '../../api/versionJournalRepository';

/** Общий жизненный цикл загрузки версий для истории и переключателя редактора. */
export const useVersionList = (
    context: EditorContextKey | undefined,
    refreshKey?: unknown,
    clearOnReload = false,
    enabled = true,
) => {
    const projectId = context?.projectId;
    const designSystemId = context?.designSystemId;
    const tenantId = context?.tenantId;
    const key = JSON.stringify([projectId, designSystemId, tenantId]);
    const [state, setState] = useState<{
        key: string;
        versions: DesignSystemVersionDto[];
        loading: boolean;
        error?: string;
    }>();
    const request = useRef<AbortController>();
    const reload = useCallback(async () => {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        if (!projectId || !designSystemId || !tenantId || !enabled) {
            setState({ key, versions: [], loading: false });
            return;
        }
        setState((current) => ({
            key,
            versions: !clearOnReload && current?.key === key ? current.versions : [],
            loading: true,
        }));
        try {
            const versions = await versionJournalRepository.listVersions(
                { projectId, designSystemId, tenantId },
                controller.signal,
            );
            if (!controller.signal.aborted) setState({ key, versions, loading: false });
        } catch {
            if (!controller.signal.aborted)
                setState((current) => ({
                    key,
                    versions: current?.key === key ? current.versions : [],
                    loading: false,
                    error: 'Не удалось загрузить версии',
                }));
        }
    }, [projectId, designSystemId, tenantId, key, clearOnReload, enabled]);
    useEffect(() => {
        void reload();
        return () => request.current?.abort();
    }, [reload, refreshKey]);
    return {
        versions: state?.key === key ? state.versions : [],
        loading: state?.key === key ? state.loading : Boolean(context),
        error: state?.key === key ? state.error : undefined,
        reload,
    };
};
