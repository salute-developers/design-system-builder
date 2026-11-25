import { createContext, useContext, useEffect } from 'react';

/** Выбор пользователя на экране редактора, который ИИ-чат передаёт серверу как контекст экрана. */
export interface EditorFocus {
    /** Выбранный токен на страницах цветов, типографики и размеров: id определения токена и его имя. */
    token?: { id: string; name?: string };
    /** Открытый компонент: конфигурация и значения вариаций, выбранные в превью. */
    component?: {
        name?: string;
        id?: string;
        appearanceId?: string;
        selectedValues?: { variation?: string; value?: string; styleId: string }[];
    };
}

type ReportEditorFocus = (focus: EditorFocus | undefined) => void;

const EditorFocusContext = createContext<ReportEditorFocus>(() => undefined);

export const EditorFocusProvider = EditorFocusContext.Provider;

/** Сообщает выбор экрана, пока экран открыт; при уходе со страницы выбор сбрасывается. */
export const useReportEditorFocus = (focus: EditorFocus | undefined) => {
    const report = useContext(EditorFocusContext);
    const key = JSON.stringify(focus ?? null);
    useEffect(() => {
        report(focus);
        return () => report(undefined);
        // Ключ сравнивает содержимое: новый объект с тем же выбором не перезаписывает его.
    }, [report, key]);
};
