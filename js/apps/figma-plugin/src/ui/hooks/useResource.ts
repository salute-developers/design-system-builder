import { useCallback, useEffect, useMemo, useState, type DependencyList } from 'react';

export type Resource<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'failed'; error: Error };

const LOADING = { state: 'loading' } as const;

/**
 * Читает данные при смене зависимостей. Результат привязан к чтению: ответ устаревшего чтения отбрасывается, а после
 * смены зависимостей прежние данные не показываются ни на один рендер.
 */
export const useResource = <T>(read: (signal: AbortSignal) => Promise<T>, deps: DependencyList) => {
    const [attempt, setAttempt] = useState(0);
    // Чтение зависит от `deps`, а не от функции, которая создаётся заново на каждом рендере.
    const current = useMemo(() => ({}), [...deps, attempt]);
    const [result, setResult] = useState<{ owner: object; resource: Resource<T> } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        const finish = (resource: Resource<T>) => {
            if (!controller.signal.aborted) setResult({ owner: current, resource });
        };
        read(controller.signal).then(
            (data) => finish({ state: 'ready', data }),
            (error: Error) => finish({ state: 'failed', error }),
        );
        return () => controller.abort();
    }, [current]);
    const retry = useCallback(() => setAttempt((value) => value + 1), []);
    const resource: Resource<T> = result?.owner === current ? result.resource : LOADING;
    return { resource, retry };
};
