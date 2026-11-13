import { useEffect } from 'react';
import type { EditorContextKey } from '../api/editorContracts';
import { invalidateEditorReads } from '../api/editorReads';

interface PreviewLocation {
    pluginUrl?: string;
    coreRelease?: { releaseId: string };
}

/** Не подключает новую сборку к старой модели, пока модель перечитывается после импорта Core. */
export const useModelPreviewUrl = (
    context: EditorContextKey | null,
    modelReleaseId: string | undefined,
    location: PreviewLocation,
    reload: () => void,
): string | undefined => {
    const previewReleaseId = location.coreRelease?.releaseId;
    const mismatch = Boolean(modelReleaseId && previewReleaseId && modelReleaseId !== previewReleaseId);

    useEffect(() => {
        if (!mismatch || !context) return;
        invalidateEditorReads(context);
        reload();
    }, [mismatch, modelReleaseId, previewReleaseId, context, reload]);

    return mismatch ? undefined : location.pluginUrl;
};
