import type { AxiosResponse } from 'axios';
import type { EditorContextKey } from './editorContracts';
import { invalidateEditorReads } from './editorReads';

/** Читает происхождение модели из фактического серверного контекста, а не из отдельного latest-запроса. */
export const componentCoreRelease = (
    response: { data?: unknown; headers?: AxiosResponse['headers'] },
    platform: string,
): string | undefined => {
    const header = response.headers?.['x-ds-read-context'];
    if (typeof header !== 'string') return undefined;
    const context = JSON.parse(header) as { coreReleases?: Array<{ platform: string; releaseId: string }> };
    return context.coreReleases?.find((release) => release.platform === platform)?.releaseId;
};

const requireSingleCoreValue = <T>(context: EditorContextKey, values: T[]): T | undefined => {
    const known = [...new Set(values)];
    if (known.length > 1) {
        invalidateEditorReads(context, { includeMetadata: true });
        throw new Error('Core изменился во время чтения. Повторите загрузку компонента.');
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
    const raw = response.headers?.['x-ds-read-context'];
    if (typeof raw !== 'string') return undefined;
    const revision = JSON.parse(raw).coreSelectionRevision;
    return Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined;
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
