import { useEffect, useMemo, useReducer, useRef } from 'react';

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
        // Раздел перечитывается при каждом открытии: значения могли измениться в другом месте.
        void reloadSizeTokens(session);
        return () => {
            session.listeners.delete(refresh);
        };
    }, [session]);

    // Новая модель темы — сигнал об изменении черновика в другом месте: раздел перечитывается после локальных очередей.
    const loadedTheme = useRef(theme);
    useEffect(() => {
        if (loadedTheme.current === theme) return;
        loadedTheme.current = theme;
        return reloadWhenDraftAutosaveIsIdle(session.context, () => void reloadSizeTokens(session));
    }, [session, theme]);

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
