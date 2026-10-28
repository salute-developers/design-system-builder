import type { EditorContextKey } from './editorContracts';
import type { AutosaveStatus } from './tokenAutosaveQueue';
import { authService } from './authService';

const statuses = new Map<string, Map<string, AutosaveStatus>>();
const idleListeners = new Map<string, Set<() => void>>();
const activityRevisions = new Map<string, number>();
const savedAtByContext = new Map<string, number>();
const statusListeners = new Map<string, Set<(status: AutosaveStatus, savedAt?: number) => void>>();
let activityRevision = 0;
type SourceOwner = { status: AutosaveStatus; detached: boolean; transferred: boolean; released: boolean };
const sourceOwners = new Map<string, Map<string, Map<symbol, SourceOwner>>>();
let sessionGeneration = 0;
authService.onSessionReset(() => {
    sessionGeneration += 1;
    sourceOwners.clear();
    statuses.clear();
    idleListeners.clear();
    activityRevisions.clear();
    savedAtByContext.clear();
    statusListeners.clear();
});

const contextKey = (context: EditorContextKey) => `${context.projectId}:${context.designSystemId}:${context.tenantId}`;

/** Каждая живая очередь владеет своим статусом, включая очередь, завершающуюся после ухода со страницы. */
export const registerDraftAutosaveSource = (context: EditorContextKey, source: string) => {
    const key = contextKey(context);
    const generation = sessionGeneration;
    const owner = Symbol(source);
    const state: SourceOwner = { status: 'saved', detached: false, transferred: false, released: false };
    const update = (status: AutosaveStatus | null) => {
        if (state.released || generation !== sessionGeneration) return;
        const sources = sourceOwners.get(key) ?? new Map<string, Map<symbol, SourceOwner>>();
        const owners = sources.get(source) ?? new Map<symbol, SourceOwner>();
        if (status === null) {
            state.released = true;
            owners.delete(owner);
        } else {
            state.status = status;
            owners.set(owner, state);
        }
        for (const [id, current] of owners) {
            if (current.detached && current.transferred && current.status === 'error') {
                current.released = true;
                owners.delete(id);
            }
        }
        if (owners.size) sources.set(source, owners);
        else sources.delete(source);
        if (sources.size) sourceOwners.set(key, sources);
        else sourceOwners.delete(key);
        const values = [...owners.values()].map((current) => current.status);
        const aggregate = (['error', 'saving', 'pending'] as const).find((value) => values.includes(value)) ?? 'saved';
        setDraftAutosaveActivity(context, source, owners.size ? aggregate : null);
    };
    return Object.assign(update, {
        detach: () => {
            state.detached = true;
            update(state.status);
        },
        /** Вызывается только после восстановления сохранённой операции в новой очереди. */
        adoptFailed: () => {
            if (state.released || generation !== sessionGeneration) return;
            for (const current of sourceOwners.get(key)?.get(source)?.values() ?? []) {
                if (current.detached) current.transferred = true;
            }
            update(state.status);
        },
    });
};

const isIdle = (key: string) => [...(statuses.get(key)?.values() ?? [])].every((status) => status === 'saved');

const statusOf = (key: string): AutosaveStatus => {
    const values = [...(statuses.get(key)?.values() ?? [])];
    return (
        (['error', 'saving', 'pending'].find((value) => values.includes(value as AutosaveStatus)) as AutosaveStatus) ??
        'saved'
    );
};

const notifyStatus = (key: string) =>
    statusListeners.get(key)?.forEach((listener) => listener(statusOf(key), savedAtByContext.get(key)));

export const getDraftAutosaveStatus = (context: EditorContextKey) => statusOf(contextKey(context));

/** Состояние одной компонентной очереди, без блокировки из-за ошибок независимых разделов. */
export const getDraftAutosaveSourceStatus = (context: EditorContextKey, source: string) =>
    statuses.get(contextKey(context))?.get(source) ?? 'saved';

/** Фиксирует только подтверждённое сервером сохранение, не завершение неуспешного запроса. */
export const recordDraftSave = (context: EditorContextKey) => {
    const key = contextKey(context);
    savedAtByContext.set(key, Math.max(Date.now(), (savedAtByContext.get(key) ?? 0) + 1));
    notifyStatus(key);
};

/** Единый статус всех очередей открытого редактора. */
export const subscribeDraftAutosaveStatus = (
    context: EditorContextKey,
    listener: (status: AutosaveStatus, savedAt?: number) => void,
) => {
    const key = contextKey(context);
    const listeners = statusListeners.get(key) ?? new Set();
    listeners.add(listener);
    statusListeners.set(key, listeners);
    listener(statusOf(key), savedAtByContext.get(key));
    return () => {
        listeners.delete(listener);
        if (!listeners.size) statusListeners.delete(key);
    };
};

/** Проверяет, что ни одна очередь выбранного редактора не содержит неподтверждённую операцию. */
export const isDraftAutosaveIdle = (context: EditorContextKey) => isIdle(contextKey(context));

/** Позволяет обнаружить запись, полностью завершившуюся за время предметного чтения. */
export const getDraftAutosaveRevision = (context: EditorContextKey) => activityRevisions.get(contextKey(context)) ?? 0;

/** Обновляет состояние одной очереди и выпускает отложенное перечитывание после подтверждения всех операций. */
export const setDraftAutosaveActivity = (context: EditorContextKey, source: string, status: AutosaveStatus | null) => {
    const key = contextKey(context);
    const contextStatuses = statuses.get(key) ?? new Map<string, AutosaveStatus>();
    const previous = contextStatuses.get(source);
    const isActive = (value: AutosaveStatus | null | undefined) => value != null && value !== 'saved';
    if (previous !== (status ?? undefined) && (isActive(previous) || isActive(status))) {
        activityRevisions.delete(key);
        activityRevisions.set(key, ++activityRevision);
    }
    if (status == null) contextStatuses.delete(source);
    else contextStatuses.set(source, status);
    if (contextStatuses.size === 0) {
        statuses.delete(key);
    } else statuses.set(key, contextStatuses);
    if (activityRevisions.size > 128) {
        for (const candidate of activityRevisions.keys()) {
            if (activityRevisions.size <= 128) break;
            if (
                candidate !== key &&
                !statuses.has(candidate) &&
                !statusListeners.has(candidate) &&
                !idleListeners.has(candidate)
            )
                activityRevisions.delete(candidate);
        }
    }
    notifyStatus(key);
    if (!isIdle(key)) return;
    const listeners = [...(idleListeners.get(key) ?? [])];
    idleListeners.delete(key);
    listeners.forEach((listener) => listener());
};

/** Выполняет перечитывание сразу либо после завершения всех локальных очередей этого редактора. */
export const reloadWhenDraftAutosaveIsIdle = (context: EditorContextKey, reload: () => void) => {
    const key = contextKey(context);
    if (isIdle(key)) {
        reload();
        return () => undefined;
    }
    const listeners = idleListeners.get(key) ?? new Set<() => void>();
    listeners.add(reload);
    idleListeners.set(key, listeners);
    return () => {
        const current = idleListeners.get(key);
        current?.delete(reload);
        if (current?.size === 0) idleListeners.delete(key);
    };
};

/** Ожидает подтверждения всех очередей выбранного редактора независимо от доступности localStorage. */
export const waitForDraftAutosaveIdle = (context: EditorContextKey, timeoutMs: number) => {
    if (isDraftAutosaveIdle(context)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        let unsubscribe: () => void = () => undefined;
        const finish = (failure?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            unsubscribe();
            if (failure) reject(failure);
            else resolve();
        };
        const timeout = setTimeout(
            () => finish(new Error('Не удалось дождаться автосохранения изменений.')),
            timeoutMs,
        );
        unsubscribe = reloadWhenDraftAutosaveIsIdle(context, () => finish());
    });
};

/** Проверяет, осталось ли после перезагрузки неотправленное изменение конфигурации компонента. */
export const hasPersistedComponentMutation = (context: EditorContextKey) => {
    const prefix = `ds_pending_component:${context.projectId}:${context.designSystemId}:${context.tenantId}:`;
    try {
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key?.startsWith(prefix) && key.endsWith(':request') && localStorage.getItem(key)) return true;
        }
        return false;
    } catch {
        // Если хранилище недоступно, нельзя гарантировать полноту публикации после перезагрузки.
        return true;
    }
};
