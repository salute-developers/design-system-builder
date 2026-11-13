import type { EditorContextKey, TokenDefinitionDto } from '../../api/editorContracts';
import { getDraftAutosaveRevision, getDraftAutosaveSourceStatus } from '../../api/draftAutosaveActivity';
import { colorTokenTypes } from './editorSections';

/** Редакция, к которой допустимо применить чтение цвета; undefined запрещает применение. */
export const colorReadRevision = (
    context: EditorContextKey,
    signal: AbortSignal,
    pending: (type: TokenDefinitionDto['type']) => boolean,
): number | undefined => {
    const ready = {
        active: !signal.aborted,
        idle: !colorTokenTypes.some(pending),
        saved: getDraftAutosaveSourceStatus(context, 'color-tokens') === 'saved',
    };
    return Object.values(ready).every(Boolean) ? getDraftAutosaveRevision(context) : undefined;
};
