import { setDraftAutosaveActivity } from '../../../api/draftAutosaveActivity';
import type { SizeToken, SizeTokens, SizeTokenValue } from '../domain';
import { createSizeTokenAutosave, type SaveStatus, type SizeTokenAutosave } from './autosave';
import {
    SizeTokenOperationError,
    type PendingSizeTokenCommands,
    type SizeTokenContext,
    type SizeTokenRepository,
    type SizeTokenResult,
} from './sizeTokenRepository';
import { applyToTheme, removeFromTheme, type ThemeModel } from './themeModel';

/** Источник очереди раздела в общем состоянии автосохранения редактора. */
export const SIZE_TOKENS_ACTIVITY_SOURCE = 'size-tokens';

/**
 * Сессия раздела темы: живёт дольше экрана, чтобы очередь пережила перемонтирование и повторила команды,
 * сохранённые до перезагрузки, даже если раздел не открыт.
 */
export interface SizeTokenSession {
    context: SizeTokenContext;
    autosave: SizeTokenAutosave;
    /** Последний ответ чтения с применёнными ответами операций — сохранённые значения. */
    data: SizeTokens | null;
    loadError: string | null;
    /** Номер последнего запущенного чтения: ответ устаревшего чтения не заменяет более новое. */
    loads: number;
    invalidation: number;
    loadedInvalidation: number;
    loadedAt?: number;
    failedInvalidation?: number;
    loading?: Promise<void>;
    readController?: AbortController;
    /** Несохранённые значения токенов по `tokenId`: их видит пользователь, пока очередь не отправит их. */
    edits: Map<string, SizeTokenValue>;
    /** Значения, отклонённые проверкой сервера: ошибка у поля, в дереве и на борде — сохранённое значение. */
    rejected: Map<string, SizeTokenOperationError>;
    /** Модель темы и перерисовка открытого экрана. */
    live: { theme: ThemeModel | null; onModelChange: () => void };
    listeners: Set<() => void>;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const notifySession = (session: SizeTokenSession) => session.listeners.forEach((listener) => listener());

const updateData = (session: SizeTokenSession, change: (tokens: SizeToken[]) => SizeToken[]) => {
    if (session.data) session.data = { ...session.data, tokens: change(session.data.tokens) };
};

/** Ответ подтверждённой операции: сохранённые значения раздела и модели темы. */
const applyResult = (session: SizeTokenSession, key: string, result: SizeTokenResult, latest: boolean) => {
    session.loads++;
    session.loadedAt = Date.now();
    const theme = session.live.theme;
    if (result.type === 'update') {
        updateData(session, (tokens) =>
            tokens.map((item) => (item.tokenId === result.token.tokenId ? result.token : item)),
        );
        if (latest) session.edits.delete(key);
        if (theme) applyToTheme(theme, result.token, result.values);
    } else if (result.type === 'create') {
        const ids = new Set(result.created.map((token) => token.tokenId));
        // Повтор создания с тем же ключом возвращает сохранённый ответ: токены не добавляются дважды.
        updateData(session, (tokens) => [...tokens.filter((item) => !ids.has(item.tokenId)), ...result.created]);
        if (theme) result.created.forEach((token) => applyToTheme(theme, token));
    } else {
        const ids = new Set(result.deletedTokenIds);
        const removed = (session.data?.tokens ?? []).filter((item) => ids.has(item.tokenId));
        ids.forEach((tokenId) => {
            session.edits.delete(tokenId);
            session.rejected.delete(tokenId);
            if (session.autosave.status(tokenId).state !== 'saved') session.autosave.forget(tokenId);
        });
        updateData(session, (tokens) => tokens.filter((item) => !ids.has(item.tokenId)));
        if (theme) removeFromTheme(theme, removed);
    }
    session.live.onModelChange();
};

/** Сессия раздела с очередью автосохранения, подключённой к общему состоянию автосохранения редактора. */
export const createSizeTokenSession = (
    context: SizeTokenContext,
    repository: SizeTokenRepository,
    store: PendingSizeTokenCommands,
): SizeTokenSession => {
    const session: SizeTokenSession = {
        context,
        autosave: undefined as unknown as SizeTokenAutosave,
        data: null,
        loadError: null,
        loads: 0,
        invalidation: 0,
        loadedInvalidation: -1,
        edits: new Map(),
        rejected: new Map(),
        live: { theme: null, onModelChange: () => undefined },
        listeners: new Set(),
    };
    session.autosave = createSizeTokenAutosave({
        repository,
        context,
        store,
        onChange: () => {
            // Общий индикатор, публикация и перечитывание по сигналу ждут подтверждения очереди раздела.
            if (!context.versionId)
                setDraftAutosaveActivity(context, SIZE_TOKENS_ACTIVITY_SOURCE, session.autosave.overall().state);
            notifySession(session);
        },
        onSaved: (key, result, latest) => applyResult(session, key, result, latest),
        onRejected: (key, error, command) => {
            if (command.operation === 'update' && command.tokenId) session.rejected.set(command.tokenId, error);
            notifySession(session);
        },
    });
    return session;
};

/** Состояние сохранения токена: очередь или отклонённое сервером значение. */
export const tokenSaveStatus = (session: SizeTokenSession, tokenId: string): SaveStatus => {
    const status = session.autosave.status(tokenId);
    if (status.state !== 'saved') return status;
    const rejected = session.rejected.get(tokenId);
    return rejected ? { state: 'error', error: rejected } : status;
};

/** Перечитывает раздел после отправки очереди: ответ чтения не опережает отправленные правки. */
export const loadSizeTokens = (session: SizeTokenSession, repository: SizeTokenRepository): Promise<void> => {
    if (session.loading) return session.loading;
    const controller = new AbortController();
    session.readController = controller;
    const run = async () => {
        await session.autosave.flush();
        if (controller.signal.aborted) return;
        const current = ++session.loads;
        const invalidation = session.invalidation;
        try {
            const data = await repository.load(session.context, controller.signal);
            if (current !== session.loads || controller.signal.aborted) return;
            session.data = data;
            session.loadError = null;
            session.failedInvalidation = undefined;
            session.loadedInvalidation = invalidation;
            session.loadedAt = Date.now();
        } catch (error) {
            if (current !== session.loads || controller.signal.aborted) return;
            session.loadError = errorText(error);
            session.failedInvalidation = invalidation;
        }
    };
    session.loading = run().finally(() => {
        session.loading = undefined;
        notifySession(session);
    });
    return session.loading;
};
