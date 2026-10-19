import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import type { Meta } from '../../controllers/componentBuilder/type';
import type { DraftChangeDto, EditorContextKey, TokenDefinitionDto } from '../../api/editorContracts';
import { versionJournalRepository as repository } from '../../api/versionJournalRepository';
import { tokenRepository } from '../../api/tokenRepository';
import type { AutosaveStatus } from '../../api/tokenAutosaveQueue';
import { presentJournal } from './journalPresenter';

interface JournalData {
    changes: DraftChangeDto[];
    tokens: TokenDefinitionDto[];
    actorLabels: Record<string, string>;
}

const emptyJournal: JournalData = { changes: [], tokens: [], actorLabels: {} };
export const errorCode = (error: unknown) => {
    let result: string | undefined;
    if (isAxiosError(error)) {
        const data: unknown = error.response?.data;
        if (data && typeof data === 'object' && 'code' in data) {
            const candidate = data.code;
            if (typeof candidate === 'string') {
                result = candidate;
            }
        }
    }
    return result;
};

const loadJournal = async (context: EditorContextKey, signal?: AbortSignal): Promise<JournalData> => {
    const [changes, tokens, actorLabels] = await Promise.all([
        repository.listChanges(context, signal),
        tokenRepository.listDefinitions(context, signal),
        repository.listProjectActorLabels(context.projectId, signal),
    ]);
    return { changes, tokens, actorLabels };
};

export const useJournal = (
    context: EditorContextKey | undefined,
    components: Meta[],
    refreshKey: unknown,
    readOnly = false,
    enabled = true,
) => {
    const contextKey = context
        ? [context.projectId, context.designSystemId, context.tenantId, context.versionId ?? 'draft'].join(':')
        : '';
    const [snapshot, setSnapshot] = useState<{ key: string; data: JournalData }>();
    const [status, setStatus] = useState<{ key: string; pending: boolean; error?: string }>();
    const request = useRef<{ generation: number; controller: AbortController }>();
    const generation = useRef(0);
    const reload = useCallback(async () => {
        if (!enabled) return;
        request.current?.controller.abort();
        const controller = new AbortController();
        const currentGeneration = ++generation.current;
        request.current = { generation: currentGeneration, controller };
        if (!context) {
            setSnapshot(undefined);
            setStatus({ key: contextKey, pending: false });
            return;
        }
        setStatus({ key: contextKey, pending: true });
        try {
            const loaded = await loadJournal(context, controller.signal);
            if (!controller.signal.aborted && request.current?.generation === currentGeneration) {
                setSnapshot({ key: contextKey, data: loaded });
                setStatus({ key: contextKey, pending: false });
            }
        } catch (cause) {
            if (!controller.signal.aborted && request.current?.generation === currentGeneration) {
                setStatus({
                    key: contextKey,
                    pending: false,
                    error:
                        errorCode(cause) === 'JOURNAL_LIMIT_EXCEEDED'
                            ? 'Журнал слишком велик для загрузки целиком'
                            : 'Не удалось загрузить журнал',
                });
            }
        }
    }, [contextKey, enabled]);
    useEffect(() => {
        void reload();
        return () => request.current?.controller.abort();
    }, [reload, refreshKey]);
    const hasSnapshot = snapshot?.key === contextKey;
    const data = hasSnapshot && snapshot ? snapshot.data : emptyJournal;
    const currentStatus = status?.key === contextKey ? status : undefined;
    const loading = Boolean(context && !hasSnapshot && (!currentStatus || currentStatus.pending));
    const error = currentStatus?.error;
    const actions = useMemo(
        () => (context ? presentJournal({ ...data, components, context, readOnly }) : []),
        [components, context, data, readOnly],
    );
    return { ...data, actions, loading, error, reload };
};

export const useReloadAfterAutosave = (status: AutosaveStatus | undefined, reload: () => Promise<void>) => {
    const previous = useRef(status);
    useEffect(() => {
        if (previous.current && previous.current !== 'saved' && status === 'saved') void reload();
        previous.current = status;
    }, [reload, status]);
};
