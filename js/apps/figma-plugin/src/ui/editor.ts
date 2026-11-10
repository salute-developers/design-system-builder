import { createContext, useContext } from 'react';

/** Имя редактора, в котором открыт плагин: окно одно для Figma и Pixso. */
export const EditorContext = createContext('Figma');

export const useEditorName = () => useContext(EditorContext);
