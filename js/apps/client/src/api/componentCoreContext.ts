import type { AxiosResponse } from 'axios';
import type { EditorContextKey } from './editorContracts';
import { invalidateEditorReads } from './editorReads';

type ReadContext = {
    coreReleases?: Array<{ platform: string; releaseId: string } | null>;
    coreSelectionRevision?: unknown;
};

const readContext = (headers?: AxiosResponse['headers']): ReadContext | undefined => {
    const header = headers?.['x-ds-read-context'];
    if (typeof header !== 'string') return undefined;
    try {
        const context: unknown = JSON.parse(header);
        return context as ReadContext | undefined;
    } catch {
        return undefined;
    }
};

class ComponentCoreMismatch extends Error {}

export const retryComponentCoreRead = async <T>(read: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    try {
        return await read();
    } catch (error) {
        if (!(error instanceof ComponentCoreMismatch) || signal?.aborted) throw error;
        return read();
    }
};

/** Читает происхождение модели из фактического серверного контекста, а не из отдельного latest-запроса. */
export const componentCoreRelease = (
    response: { data?: unknown; headers?: AxiosResponse['headers'] },
    platform: string,
): string | undefined => {
    const releases = readContext(response.headers)?.coreReleases;
    if (!Array.isArray(releases)) return undefined;
    return releases.find((release) => release?.platform === platform && typeof release.releaseId === 'string')?.releaseId;
};

const requireSingleCoreValue = <T>(context: EditorContextKey, values: T[]): T | undefined => {
    const known = [...new Set(values)];
    if (known.length > 1) {
        invalidateEditorReads(context, { includeMetadata: true });
        throw new ComponentCoreMismatch('Core изменился во время чтения. Повторите загрузку компонента.');
    }
    return known[0];
};

/** Смена выбора Core между списочными чтениями требует нового чтения всей модели. */
export const requireSameComponentCore = (
    context: EditorContextKey,
    releases: Array<string | undefined>,
): string | undefined =>
    requireSingleCoreValue(
        context,
        releases.filter((release): release is string => Boolean(release)),
    );

/** Ревизия относится к загруженной модели и не заменяется ревизией другого экрана. */
export const componentCoreSelectionRevision = (response: {
    data?: unknown;
    headers?: AxiosResponse['headers'];
}): number | undefined => {
    const revision = readContext(response.headers)?.coreSelectionRevision;
    return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined;
};

export const requireSameCoreSelectionRevision = (
    context: EditorContextKey,
    responses: Array<{ data?: unknown; headers?: AxiosResponse['headers'] }>,
): number | undefined => {
    return requireSingleCoreValue(
        context,
        responses.map(componentCoreSelectionRevision).filter((revision) => revision !== undefined),
    );
};
