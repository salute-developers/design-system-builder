import type { TokenDefinitionDto } from '../../api/editorContracts';

export type EditorSection =
    | 'colors'
    | 'palette'
    | 'typography'
    | 'shapes'
    | 'components'
    | 'changes'
    | 'versions'
    | 'icons'
    | 'settings';

/** Типы цветового раздела используются совместно чтением и защитой неподтверждённого ввода. */
export const colorTokenTypes: TokenDefinitionDto['type'][] = ['color', 'gradient'];

/** Раздел — целая единица чтения, без отдельных жизненных циклов платформ и параметров. */
export const sectionTokenTypes: Partial<Record<EditorSection, TokenDefinitionDto['type'][]>> = {
    colors: colorTokenTypes,
    typography: ['typography', 'fontFamily'],
    shapes: ['shape', 'spacing', 'shadow'],
};

export const editorSection = (value?: string): EditorSection =>
    ['palette', 'typography', 'shapes', 'components', 'changes', 'versions', 'icons', 'settings'].includes(value ?? '')
        ? (value as EditorSection)
        : 'colors';
