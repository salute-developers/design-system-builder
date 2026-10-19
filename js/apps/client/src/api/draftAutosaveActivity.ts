import type { EditorContextKey } from './editorContracts';
import type { AutosaveStatus } from './tokenAutosaveQueue';

const statuses = new Map<string, Map<string, AutosaveStatus>>();
const idleListeners = new Map<string, Set<() => void>>();
const activityRevisions = new Map<string, number>();
let activityRevision = 0;

const contextKey = (context: EditorContextKey) => `${context.projectId}:${context.designSystemId}:${context.tenantId}`;

const isIdle = (key: string) => [...(statuses.get(key)?.values() ?? [])].every((status) => status === 'saved');

/** Проверяет, что ни одна очередь выбранного редактора не содержит неподтверждённую операцию. */
export const isDraftAutosaveIdle = (context: EditorContextKey) => isIdle(contextKey(context));

/** Позволяет обнаружить запись, полностью завершившуюся за время предметного чтения. */
export const getDraftAutosaveRevision = (context: EditorContextKey) => activityRevisions.get(contextKey(context)) ?? 0;

/** Обновляет состояние одной очереди и выпускает отложенное перечитывание после подтверждения всех операций. */
export const setDraftAutosaveActivity = (context: EditorContextKey, source: string, status: AutosaveStatus | null) => {
    const key = contextKey(context);
    const contextStatuses = statuses.get(key) ?? new Map<string, AutosaveStatus>();
    if (contextStatuses.get(source) !== (status ?? undefined)) activityRevisions.set(key, ++activityRevision);
    if (status == null) contextStatuses.delete(source);
    else contextStatuses.set(source, status);
    if (contextStatuses.size === 0) {
        statuses.delete(key);
        activityRevisions.delete(key);
    } else statuses.set(key, contextStatuses);
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
