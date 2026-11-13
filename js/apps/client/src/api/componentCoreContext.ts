import type { AxiosResponse } from 'axios';
import type { EditorContextKey } from './editorContracts';
import { invalidateEditorReads } from './editorReads';

/** Читает происхождение модели из фактического серверного контекста, а не из отдельного latest-запроса. */
export const componentCoreRelease = (response: { data?: unknown; headers?: AxiosResponse['headers'] }, platform: string): string | undefined => {
    const header = response.headers?.['x-ds-read-context'];
    if (typeof header !== 'string') return undefined;
    const context = JSON.parse(header) as { coreReleases?: Array<{ platform: string; releaseId: string }> };
    return context.coreReleases?.find((release) => release.platform === platform)?.releaseId;
};

/** Импорт между списочными чтениями требует нового чтения всей модели. */
export const requireSameComponentCore = (context: EditorContextKey, releases: Array<string | undefined>): string | undefined => {
    const known = [...new Set(releases.filter((release): release is string => Boolean(release)))];
    if (known.length > 1) {
        invalidateEditorReads(context);
        throw new Error('Core изменился во время чтения. Повторите загрузку компонента.');
    }
    return known[0];
};
