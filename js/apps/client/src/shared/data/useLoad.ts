import { useCallback, useEffect, useRef, useState } from 'react';

import { invalidateEditorResources } from '../../api/editorReads';
import { PROJECTS_URL } from '../../api/constants';
import { authService } from '../../api/authService';
import type { DesignSystem } from '../../modules/designSystems/domain/designSystem';
import type { Project } from '../../modules/projects/domain/project';
import { ApiError } from './apiRequest';

type QueryEntry<T = unknown> = {
    data?: T;
    error?: unknown;
    promise?: Promise<T | undefined>;
    requestId: number;
    updatedAt?: number;
    revision: number;
    controller?: AbortController;
    listeners: Set<() => void>;
};

const queryCache = new Map<string, QueryEntry>();

const getEntry = <T>(key: string): QueryEntry<T> => {
    for (const [cachedKey, entry] of queryCache) {
        if (
            cachedKey !== key &&
            !entry.listeners.size &&
            !entry.promise &&
            entry.updatedAt !== undefined &&
            Date.now() - entry.updatedAt >= 30_000
        )
            queryCache.delete(cachedKey);
    }
    const existing = queryCache.get(key) as QueryEntry<T> | undefined;
    if (existing) return existing;
    const entry: QueryEntry<T> = { requestId: 0, revision: 0, listeners: new Set() };
    queryCache.set(key, entry);
    return entry;
};

const notify = (entry: QueryEntry) => entry.listeners.forEach((listener) => listener());

const storeValue = (key: string, value: unknown) => {
    const entry = getEntry(key);
    entry.requestId += 1;
    entry.controller?.abort();
    entry.data = value;
    entry.updatedAt = Date.now();
    entry.error = undefined;
    entry.promise = undefined;
    notify(entry);
};

const resourceUrls = (key: string) => {
    if (key === 'projects') return [PROJECTS_URL];
    if (key.startsWith('project:')) return [`${PROJECTS_URL}/${key.slice('project:'.length)}`];
    if (key.startsWith('members:')) return [`${PROJECTS_URL}/${key.slice('members:'.length)}/members`];
    const [kind, projectId, id] = key.split(':');
    if (kind === 'systems') return [`${PROJECTS_URL}/${projectId}/ds/design-systems`];
    if (kind === 'system') return [`${PROJECTS_URL}/${projectId}/ds/design-systems/${id}`];
    if (kind === 'themes') return [`${PROJECTS_URL}/${projectId}/ds/design-systems/${id}/tenants`];
    return [];
};

/** Связанная мутация помечает только свои ключи; запрос выполняет активный потребитель. */
export const invalidateQueryCache = (...keys: string[]) => {
    invalidateEditorResources(keys.flatMap(resourceUrls));
    for (const key of keys) {
        const entry = getEntry(key);
        entry.requestId++;
        entry.controller?.abort();
        entry.revision++;
        entry.updatedAt = undefined;
        entry.promise = undefined;
        notify(entry);
    }
};

export const resetQueryCache = () => {
    const entries = [...queryCache.values()];
    entries.forEach((entry) => {
        entry.requestId += 1;
        entry.controller?.abort();
        entry.data = undefined;
        entry.updatedAt = undefined;
        entry.error = undefined;
        entry.promise = undefined;
        notify(entry);
    });
};

export const setQueryCache = (key: string, value: unknown) => {
    storeValue(key, value);
    cacheEntities(key, value);
};

authService.onSessionReset(resetQueryCache);

const cacheEntities = (cacheKey: string | undefined, data: unknown) => {
    if (!cacheKey || !Array.isArray(data)) return;
    const prefix = cacheKey === 'projects' ? 'project:' : cacheKey.startsWith('systems:') ? 'system:' : '';
    if (!prefix) return;
    data.forEach((item: Project | DesignSystem) => {
        if (
            prefix === 'project:' &&
            !(item as Project).ownerDisplayName &&
            !(item as Project).ownerUsername &&
            !(item as Project).ownerEmail
        )
            return;
        const key =
            prefix === 'project:' ? `${prefix}${item.id}` : `${prefix}${(item as DesignSystem).projectId}:${item.id}`;
        storeValue(key, item);
    });
};

export const isAccessDenied = (error: unknown) => error instanceof ApiError && error.status === 403;

export const useLoad = <T>(
    loader: (signal?: AbortSignal) => Promise<T>,
    dependencies: unknown[],
    cacheKey?: string,
    enabled = true,
) => {
    type LocalState = { data?: T; error?: unknown };
    const [localState, setLocalState] = useState<LocalState>({});
    const [, render] = useState(0);
    const localRequestId = useRef(0);
    const localController = useRef<AbortController | undefined>(undefined);

    useEffect(() => {
        if (!cacheKey || !enabled) return;
        const entry = getEntry<T>(cacheKey);
        const listener = () => render((version) => version + 1);
        entry.listeners.add(listener);
        return () => {
            entry.listeners.delete(listener);
            queueMicrotask(() => {
                if (entry.listeners.size === 0 && entry.promise) {
                    entry.requestId += 1;
                    entry.controller?.abort();
                    entry.promise = undefined;
                }
            });
        };
    }, [cacheKey, enabled]);

    const load = useCallback(
        async (force: boolean) => {
            if (!enabled) return undefined;
            if (!cacheKey) {
                const requestId = ++localRequestId.current;
                localController.current?.abort();
                const controller = new AbortController();
                localController.current = controller;
                setLocalState((current) => ({ data: current.data }));
                try {
                    const data = await loader(controller.signal);
                    if (requestId === localRequestId.current) setLocalState({ data });
                    return data;
                } catch (error) {
                    if (requestId === localRequestId.current) setLocalState({ error });
                    return undefined;
                }
            }

            const entry = getEntry<T>(cacheKey);
            if (entry.promise) return entry.promise;
            if (force) invalidateEditorResources(resourceUrls(cacheKey));
            const requestId = ++entry.requestId;
            entry.error = undefined;
            const controller = new AbortController();
            entry.controller = controller;
            const promise = loader(controller.signal)
                .then((data) => {
                    if (entry.requestId !== requestId) return undefined;
                    entry.data = data;
                    entry.updatedAt = Date.now();
                    entry.error = undefined;
                    cacheEntities(cacheKey, data);
                    notify(entry);
                    return data;
                })
                .catch((error: unknown) => {
                    if (entry.requestId !== requestId) return undefined;
                    entry.error = error;
                    if (error instanceof ApiError && [401, 403].includes(error.status ?? 0)) {
                        entry.data = undefined;
                        entry.updatedAt = undefined;
                    }
                    notify(entry);
                    return undefined;
                })
                .finally(() => {
                    if (entry.requestId === requestId) entry.promise = undefined;
                });
            entry.promise = promise;
            notify(entry);
            return promise;
        },
        [...dependencies, cacheKey, enabled],
    );

    const reload = useCallback(() => load(true), [load]);
    const revision = cacheKey ? getEntry(cacheKey).revision : 0;
    useEffect(() => {
        if (!enabled) return;
        const revalidate = () => {
            const entry = cacheKey ? getEntry<T>(cacheKey) : undefined;
            if (!entry || entry.updatedAt === undefined || Date.now() - entry.updatedAt >= 30_000) void load(false);
        };
        revalidate();
        window.addEventListener('focus', revalidate);
        return () => {
            window.removeEventListener('focus', revalidate);
            if (!cacheKey) {
                localRequestId.current++;
                localController.current?.abort();
            }
        };
    }, [load, cacheKey, enabled, revision]);

    const state = cacheKey ? getEntry<T>(cacheKey) : localState;
    return { data: state.data, error: enabled ? state.error : undefined, reload };
};
