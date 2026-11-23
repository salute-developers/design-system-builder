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

/** Смена выбора Core между списочными чтениями требует нового чтения всей модели. */
export const requireSameComponentCore = (
    context: EditorContextKey,
    releases: Array<string | undefined>,
): string | undefined => {
    const known = [...new Set(releases.filter((release): release is string => Boolean(release)))];
    if (known.length > 1) {
        invalidateEditorReads(context, { includeMetadata: true });
        throw new Error('Core изменился во время чтения. Повторите загрузку компонента.');
    }
    return known[0];
};

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
    const revisions = [
        ...new Set(responses.map(componentCoreSelectionRevision).filter((revision) => revision !== undefined)),
    ];
    if (revisions.length > 1) {
        invalidateEditorReads(context, { includeMetadata: true });
        throw new Error('Core изменился во время чтения. Повторите загрузку компонента.');
    }
    return revisions[0];
};
