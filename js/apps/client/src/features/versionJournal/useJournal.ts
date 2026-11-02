import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import type { Meta } from '../../controllers/componentBuilder/type';
import type { DraftChangeDto, EditorContextKey, PaletteDto, TokenDefinitionDto } from '../../api/editorContracts';
import { versionJournalRepository as repository } from '../../api/versionJournalRepository';
import { tokenRepository } from '../../api/tokenRepository';
import type { AutosaveStatus } from '../../api/tokenAutosaveQueue';
import { presentJournal, isComponentJournalChange } from './journalPresenter';
import { loadJournalComponentMetadata, type JournalComponentMetadata } from '../../api/journalComponentMetadata';

interface JournalData {
    changes: DraftChangeDto[];
    total?: number;
    readAt?: number;
    tokens: TokenDefinitionDto[];
    tokensReadAt?: number;
    actorLabels: Record<string, string>;
    componentMetadata?: JournalComponentMetadata;
    palette: PaletteDto[];
}

const emptyJournal: JournalData = { changes: [], tokens: [], actorLabels: {}, palette: [] };
export const errorCode = (error: unknown) => {
    let result: string | undefined;
    if (isAxiosError(error)) {
        const data: unknown = error.response?.data;
        if (data && typeof data === 'object') {
            const body = data as { code?: unknown; error?: unknown };
            const candidate = body.code ?? body.error;
            if (typeof candidate === 'string') {
                result = candidate;
            }
        }
    }
    return result;
};

const definitionCursor = (changes: DraftChangeDto[]) =>
    JSON.stringify(
        changes
            .filter((change) => change.entityType === 'token')
            .map((change) => [change.entityId, change.editRevision])
            .sort(),
    );

const loadJournal = async (
    context: EditorContextKey,
    signal?: AbortSignal,
    previous?: JournalData,
): Promise<JournalData> => {
    let total: number | undefined;
    const [changes, actorLabels] = await Promise.all([
        repository.listChanges(context, signal, (value) => {
            total = value;
        }),
        repository.listProjectActorLabels(context.projectId, signal),
    ]);
    // Изменение значения не меняет имена/типы. Отмена определения или новая его редакция меняет cursor.
    const reuseDefinitions =
        previous?.tokensReadAt !== undefined &&
        Date.now() - previous.tokensReadAt < 30_000 &&
        definitionCursor(previous.changes) === definitionCursor(changes);
    const tokens = reuseDefinitions ? previous.tokens : await tokenRepository.listDefinitions(context, signal);
    const tokensReadAt = reuseDefinitions ? previous.tokensReadAt : Date.now();
    const componentMetadata = changes.some(isComponentJournalChange)
        ? await loadJournalComponentMetadata(context, signal)
        : undefined;
    // Палитра нужна только значениям, записанным ссылкой `palette_id`.
    const palette = changes.some((change) => change.previousValue?.palette_id || change.currentValue?.palette_id)
        ? await tokenRepository.listPalette(context, signal)
        : [];
    return { changes, total, readAt: Date.now(), tokens, tokensReadAt, actorLabels, componentMetadata, palette };
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
    const confirmed = useRef<{ key: string; data: JournalData }>();
    const reloadData = useCallback(
        async (propagateFailure: boolean) => {
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
                const loaded = await loadJournal(
                    context,
                    controller.signal,
                    confirmed.current?.key === contextKey ? confirmed.current.data : undefined,
                );
                if (!controller.signal.aborted && request.current?.generation === currentGeneration) {
                    confirmed.current = { key: contextKey, data: loaded };
                    setSnapshot(confirmed.current);
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
                if (propagateFailure) throw cause;
            }
        },
        [contextKey, enabled],
    );
    const reload = useCallback(() => reloadData(false), [reloadData]);
    const reloadChecked = useCallback(() => reloadData(true), [reloadData]);
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
    return { ...data, actions, loading, error, reload, reloadChecked };
};

export const useReloadAfterAutosave = (status: AutosaveStatus | undefined, reload: () => Promise<void>) => {
    const previous = useRef(status);
    useEffect(() => {
        if (previous.current && previous.current !== 'saved' && status === 'saved') void reload();
        previous.current = status;
    }, [reload, status]);
};
