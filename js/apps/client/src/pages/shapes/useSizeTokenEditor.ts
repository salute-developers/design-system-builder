import { useEffect, useMemo, useReducer } from 'react';

import type { DesignSystem, Theme } from '../../controllers';
import type { SizeTokenContext } from '../../modules/sizeTokens';
import { createSizeTokenEditor, loadSizeTokens, sizeTokenSession } from './sizeTokenEditor';

interface EditorInput {
    context: SizeTokenContext;
    designSystem: DesignSystem;
    theme: Theme;
    rerender: () => void;
    reload: () => void;
}

/** Раздел «Отступы, радиусы и тени»: сессия темы, редактор с автосохранением и его состояние. */
export const useSizeTokenEditor = ({ context, designSystem, theme, rerender, reload }: EditorInput) => {
    const session = useMemo(
        () => sizeTokenSession(context),
        [context.projectId, context.designSystemId, context.tenantId],
    );
    const [version, refresh] = useReducer((value: number) => value + 1, 0);

    // Сессия видит текущую тему и дизайн-систему: после перезагрузки темы ответы операций пишутся в новую модель.
    session.theme = theme;
    session.designSystem = designSystem;
    session.onModelChange = rerender;
    session.reloadTheme = reload;

    useEffect(() => {
        session.listeners.add(refresh);
        // Раздел перечитывается при каждом открытии: значения могли измениться в другом месте.
        void loadSizeTokens(session);
        return () => {
            session.listeners.delete(refresh);
        };
    }, [session]);

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
