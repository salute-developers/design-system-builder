import type { TokenDefinitionDto } from '../../api/editorContracts';

export type EditorSection =
    | 'colors'
    | 'palette'
    | 'typography'
    | 'shapes'
    | 'components'
    | 'changes'
    | 'versions'
    | 'settings';

/** Раздел — целая единица чтения, без отдельных жизненных циклов платформ и параметров. */
export const sectionTokenTypes: Partial<Record<EditorSection, TokenDefinitionDto['type'][]>> = {
    colors: ['color', 'gradient'],
    typography: ['typography', 'fontFamily'],
    shapes: ['shape', 'spacing', 'shadow'],
};

export const editorSection = (value?: string): EditorSection =>
    ['palette', 'typography', 'shapes', 'components', 'changes', 'versions', 'settings'].includes(value ?? '')
        ? (value as EditorSection)
        : 'colors';
