import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorContextKey } from '../api/editorContracts';
import { coreCompatibilityRepository, type CoreCompatibilityReport } from '../api/coreCompatibilityRepository';
import { invalidateEditorReads } from '../api/editorReads';

/** Смена Core не меняет draftRevision: повторяем чтение при фокусе и пока открыт экран. */
export const useCoreCompatibility = (context?: EditorContextKey | null, componentId?: string, onCoreChanged?: () => void) => {
    const changeCallback = useRef(onCoreChanged);
    changeCallback.current = onCoreChanged;
    const key = context
        ? JSON.stringify([context.projectId, context.designSystemId, context.versionId, componentId])
        : '';
    const [generation, setGeneration] = useState(0);
    const [state, setState] = useState<{ key: string; report?: CoreCompatibilityReport; error?: string }>({ key: '' });
    const reload = useCallback(() => {
        setState({ key: '' });
        setGeneration((value) => value + 1);
    }, []);
    useEffect(() => {
        if (!context) return;
        let controller: AbortController | undefined;
        let previousCore: string | undefined;
        const read = () => {
            controller?.abort();
            const attempt = new AbortController();
            controller = attempt;
            void coreCompatibilityRepository
                .read(context, componentId, attempt.signal)
                .then((report) => {
                    if (attempt.signal.aborted) return;
                    const core = JSON.stringify(report.context.coreReleases);
                    if (previousCore !== core) {
                    invalidateEditorReads(context);
                    changeCallback.current?.();
                }
                    previousCore = core;
                    setState({ key, report });
                })
                .catch((error: unknown) => {
                    if (!attempt.signal.aborted)
                        setState({ key, error: error instanceof Error ? error.message : String(error) });
                });
        };
        read();
        const interval = window.setInterval(read, 30_000);
        window.addEventListener('focus', read);
        return () => {
            controller?.abort();
            window.clearInterval(interval);
            window.removeEventListener('focus', read);
        };
        // Контекст задаётся семантическим ключом, а не ссылкой объекта.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, generation]);
    return {
        report: state.key === key ? state.report : undefined,
        error: state.key === key ? state.error : undefined,
        reload,
    };
};
