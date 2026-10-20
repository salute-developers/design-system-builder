import type { EditorContextKey } from './editorContracts';
import type { AutosaveStatus } from './tokenAutosaveQueue';
import { authService } from './authService';

const statuses = new Map<string, Map<string, AutosaveStatus>>();
const idleListeners = new Map<string, Set<() => void>>();
const activityRevisions = new Map<string, number>();
const savedAtByContext = new Map<string, number>();
const statusListeners = new Map<string, Set<(status: AutosaveStatus, savedAt?: number) => void>>();
let activityRevision = 0;
authService.onSessionReset(() => {
    statuses.clear();
    idleListeners.clear();
    activityRevisions.clear();
    savedAtByContext.clear();
    statusListeners.clear();
});

const contextKey = (context: EditorContextKey) => `${context.projectId}:${context.designSystemId}:${context.tenantId}`;

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

/** Фиксирует только подтверждённое сервером сохранение, не завершение неуспешного запроса. */
export const recordDraftSave = (context: EditorContextKey) => {
    const key = contextKey(context);
    savedAtByContext.set(key, Date.now());
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
    if (contextStatuses.get(source) !== (status ?? undefined)) {
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
