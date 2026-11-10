import { createContext, useContext } from 'react';

import type { ExportEditor } from '../shared/editor';

/**
 * Редактор, в котором открыт плагин: окно одно для Figma и Pixso. До ответа основного потока — `null`, и экспорт
 * недоступен: план зависит от возможностей редактора.
 */
export const EditorContext = createContext<ExportEditor | null>(null);

export const useEditor = () => useContext(EditorContext);
