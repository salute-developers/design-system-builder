import type { ReactNode } from 'react';

import type { Resource } from '../hooks/useResource';

/** Загрузка и ошибка с «Повторить» вокруг готовых данных. */
export const ResourceView = <T,>({
    resource,
    retry,
    loading,
    children,
}: {
    resource: Resource<T>;
    retry: () => void;
    loading: string;
    children: (data: T) => ReactNode;
}) => {
    if (resource.state === 'loading')
        return (
            <p className="status" role="status">
                {loading}
            </p>
        );
    if (resource.state === 'failed')
        return (
            <div className="status" role="alert">
                <p>{resource.error.message}</p>
                <button type="button" onClick={retry}>
                    Повторить
                </button>
            </div>
        );
    return <>{children(resource.data)}</>;
};
