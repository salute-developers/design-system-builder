import { useEffect, useMemo, useReducer } from 'react';

import { reloadWhenDraftAutosaveIsIdle } from '../../api/draftAutosaveActivity';
import type { Theme } from '../../controllers';
import { reloadSizeTokens, sizeTokenSession, type SizeTokenContext } from '../../modules/sizeTokens';
import { createSizeTokenEditor } from './sizeTokenEditor';

interface EditorInput {
    context: SizeTokenContext;
    theme: Theme;
    rerender: () => void;
}

/** Раздел «Отступы, радиусы и тени»: сессия темы, редактор с автосохранением и перечитывание по сигналу. */
export const useSizeTokenEditor = ({ context, theme, rerender }: EditorInput) => {
    const session = useMemo(
        () => sizeTokenSession(context),
        [context.projectId, context.designSystemId, context.tenantId, context.versionId],
    );
    const [version, refresh] = useReducer((value: number) => value + 1, 0);

    // Ответы операций пишутся в текущую модель темы: после перечитывания темы — в новую.
    session.live = { theme, onModelChange: rerender };

    useEffect(() => {
        session.listeners.add(refresh);
        session.failedInvalidation = undefined;
        if (session.loadedAt !== undefined && Date.now() - session.loadedAt >= 30_000) session.invalidation++;
        return () => {
            session.listeners.delete(refresh);
            queueMicrotask(() => {
                if (!session.listeners.size) session.readController?.abort();
            });
        };
    }, [session]);

    useEffect(() => {
        if (
            session.loadedInvalidation === session.invalidation ||
            session.failedInvalidation === session.invalidation ||
            session.loading
        )
            return;
        return reloadWhenDraftAutosaveIsIdle(session.context, () => {
            void reloadSizeTokens(session);
        });
    }, [session, session.invalidation, session.loadedInvalidation, Boolean(session.loading)]);

    // Уход со страницы: очередь отправляется сразу, а несохранённые правки предупреждают браузер.
    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (!session.autosave.hasUnsaved()) return;
            void session.autosave.flush();
            event.preventDefault();
        };
        window.addEventListener('beforeunload', beforeUnload);
        return () => {
            window.removeEventListener('beforeunload', beforeUnload);
            void session.autosave.flush();
        };
    }, [session]);

    const editor = useMemo(() => createSizeTokenEditor(session), [session]);

    return { session, editor, version, status: session.autosave.overall() };
};
