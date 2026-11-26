import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { EditorContextKey } from '../api/editorContracts';
import { invalidateEditorReads } from '../api/editorReads';
import { compatibilityWatch } from './coreCompatibilityWatch';

/** Разделяет опрос между экранами и сообщает только о смене уже известного Core. */
export const useCoreCompatibility = (
    context?: EditorContextKey | null,
    componentId?: string,
    onCoreChanged?: () => void,
    knownCoreRevision?: number | null,
) => {
    const callback = useRef(onCoreChanged);
    callback.current = onCoreChanged;
    const key = JSON.stringify([context?.projectId, context?.designSystemId, context?.versionId, componentId]);
    const watch = useMemo(() => compatibilityWatch(key, context, componentId), [key]);
    const state = useSyncExternalStore(watch.subscribe, watch.getSnapshot);
    const core = JSON.stringify([state.report?.context.coreSelectionRevision, state.report?.context.coreReleases]);
    const last = useRef<{ key: string; core?: string; mismatch?: string }>();
    useEffect(() => {
        if (!state.report) return;
        const revision = state.report.context.coreSelectionRevision;
        const mismatch =
            knownCoreRevision != null && revision != null && knownCoreRevision !== revision
                ? `${knownCoreRevision}:${revision}`
                : undefined;
        const previous = last.current?.key === key ? last.current : undefined;
        const needsModel = mismatch !== undefined && mismatch !== previous?.mismatch;
        const coreChanged = previous && previous.core !== core;
        if (needsModel && !coreChanged) invalidateEditorReads(context!, { includeMetadata: true });
        if (needsModel || coreChanged) callback.current?.();
        last.current = { key, core, mismatch };
    }, [key, core, knownCoreRevision]);
    return { ...state, reload: watch.read };
};
