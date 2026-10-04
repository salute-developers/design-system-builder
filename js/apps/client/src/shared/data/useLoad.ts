import { useCallback, useEffect, useRef, useState } from 'react';

import { authService } from '../../api/authService';
import type { DesignSystem } from '../../modules/designSystems/domain/designSystem';
import type { Project } from '../../modules/projects/domain/project';
import { ApiError } from './apiRequest';

type QueryEntry<T = unknown> = {
    data?: T;
    error?: unknown;
    promise?: Promise<T | undefined>;
    requestId: number;
    listeners: Set<() => void>;
};

const queryCache = new Map<string, QueryEntry>();

const getEntry = <T>(key: string): QueryEntry<T> => {
    const existing = queryCache.get(key) as QueryEntry<T> | undefined;
    if (existing) return existing;
    const entry: QueryEntry<T> = { requestId: 0, listeners: new Set() };
    queryCache.set(key, entry);
    return entry;
};

const notify = (entry: QueryEntry) => entry.listeners.forEach((listener) => listener());

const storeValue = (key: string, value: unknown) => {
    const entry = getEntry(key);
    entry.requestId += 1;
    entry.data = value;
    entry.error = undefined;
    entry.promise = undefined;
    notify(entry);
};

export const resetQueryCache = () => {
    const entries = [...queryCache.values()];
    entries.forEach((entry) => {
        entry.requestId += 1;
        entry.data = undefined;
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

export const useLoad = <T>(loader: () => Promise<T>, dependencies: unknown[], cacheKey?: string) => {
    type LocalState = { data?: T; error?: unknown };
    const [localState, setLocalState] = useState<LocalState>({});
    const [, render] = useState(0);
    const localRequestId = useRef(0);

    useEffect(() => {
        if (!cacheKey) return;
        const entry = getEntry<T>(cacheKey);
        const listener = () => render((version) => version + 1);
        entry.listeners.add(listener);
        return () => {
            entry.listeners.delete(listener);
            if (entry.listeners.size === 0 && entry.promise) {
                entry.requestId += 1;
                entry.promise = undefined;
            }
        };
    }, [cacheKey]);

    const reload = useCallback(async () => {
        if (!cacheKey) {
            const requestId = ++localRequestId.current;
            setLocalState((current) => ({ data: current.data }));
            try {
                const data = await loader();
                if (requestId === localRequestId.current) setLocalState({ data });
                return data;
            } catch (error) {
                if (requestId === localRequestId.current) setLocalState({ error });
                return undefined;
            }
        }

        const entry = getEntry<T>(cacheKey);
        if (entry.promise) return entry.promise;
        const requestId = ++entry.requestId;
        entry.error = undefined;
        const promise = loader()
            .then((data) => {
                if (entry.requestId !== requestId) return undefined;
                entry.data = data;
                entry.error = undefined;
                cacheEntities(cacheKey, data);
                notify(entry);
                return data;
            })
            .catch((error: unknown) => {
                if (entry.requestId !== requestId) return undefined;
                entry.error = error;
                notify(entry);
                return undefined;
            })
            .finally(() => {
                if (entry.requestId === requestId) entry.promise = undefined;
            });
        entry.promise = promise;
        notify(entry);
        return promise;
    }, [...dependencies, cacheKey]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const state = cacheKey ? getEntry<T>(cacheKey) : localState;
    return { data: state.data, error: state.error, reload };
};
