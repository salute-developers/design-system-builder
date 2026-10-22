import { PROJECTS_URL } from './constants';
import type { EditorContextKey } from './editorContracts';

export const apiRoot = (projectId: string) => `${PROJECTS_URL}/${projectId}/ds`;
export const tokenValueKey = (tokenId: string, platform: string | null, mode: string | null) =>
    `${tokenId}:${platform ?? ''}:${mode ?? ''}`;

export const readRequest = (context: EditorContextKey, signal?: AbortSignal) => ({
    signal,
    params: context.versionId ? { versionId: context.versionId } : undefined,
});

export const keepaliveRequest = (keepalive: boolean) =>
    keepalive ? { adapter: 'fetch' as const, fetchOptions: { keepalive: true } } : {};

export const parseMutationMetadata = (
    raw: unknown,
): Array<{ entityType: string; entityId: string; revision: number }> => {
    if (typeof raw !== 'string') return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.filter(
                  (item) =>
                      item &&
                      typeof item.entityType === 'string' &&
                      typeof item.entityId === 'string' &&
                      Number.isSafeInteger(item.revision) &&
                      item.revision >= 0,
              )
            : [];
    } catch {
        return [];
    }
};
