import { createContext, useContext } from 'react';

import type { ExportEditor } from '../shared/editor';

/**
 * Редактор, в котором открыт плагин: окно одно для Figma и Pixso. До ответа основного потока `editor` — `null`, и экспорт
 * недоступен: план зависит от возможностей редактора. Отказ ответа хранится в `failure`, `retry` запрашивает снова.
 */
export interface EditorState {
    editor: ExportEditor | null;
    failure?: string;
    retry?: () => void;
}

export const EditorContext = createContext<EditorState>({ editor: null });

export const useEditor = () => useContext(EditorContext).editor;

export const useEditorState = () => useContext(EditorContext);
