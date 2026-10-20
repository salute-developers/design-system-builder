import type { EditorContextKey } from './editorContracts';

type RefreshScope = 'theme-tokens' | 'all';
const listeners = new Set<(path: string) => void>();

/** Неполные технические метаданные не являются ошибкой уже сохранённой операции. */
export const reportIncompleteMutationMetadata = (response: {
    headers: Record<string, unknown>;
    config: { url?: string };
}) => {
    if (response.headers['x-ds-mutation-metadata-truncated'] !== 'true' || !response.config.url) return;
    const path = new URL(response.config.url, 'http://editor.local').pathname;
    listeners.forEach((listener) => listener(path));
};

/** Просит активный редактор того же проекта перечитать полные редакции после подтверждения очередей. */
export const subscribeIncompleteMutationMetadata = (
    context: EditorContextKey,
    refresh: (scope: RefreshScope) => void,
) => {
    const prefix = `/projects/${encodeURIComponent(context.projectId)}/ds/`;
    const listener = (path: string) => {
        if (!path.includes(prefix) || context.versionId) return;
        refresh(
            /\/(?:color-tokens|palette|token-groups|token-values|tokens)(?:\/|$)/.test(path) ? 'theme-tokens' : 'all',
        );
    };
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
