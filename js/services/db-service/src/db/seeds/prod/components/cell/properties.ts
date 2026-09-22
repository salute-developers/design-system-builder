import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'cellGap', type: 'dimension', variations: ['size'], params: { web: ['cellGap'] } },
    { name: 'cellTitleColor', type: 'color', variations: ['view'], params: { web: ['cellTitleColor'] } },
    { name: 'cellLabelStyle', type: 'typography', variations: ['size'], params: { web: ['cellLabelFontFamily', 'cellLabelFontWeight', 'cellLabelFontSize', 'cellLabelFontStyle', 'cellLabelLetterSpacing', 'cellLabelLineHeight'] } },
    { name: 'cellTitleStyle', type: 'typography', variations: ['size'], params: { web: ['cellTitleFontStyle', 'cellTitleLineHeight', 'cellTitleFontFamily', 'cellTitleFontSize', 'cellTitleFontWeight', 'cellTitleLetterSpacing'] } },
    { name: 'cellPadding', type: 'dimension', variations: ['size'], params: { web: ['cellPadding'] } },
    { name: 'cellPaddingRightContent', type: 'dimension', variations: ['size'], params: { web: ['cellPaddingRightContent'] } },
    { name: 'cellWidth', type: 'dimension', variations: ['size'], params: { web: ['cellWidth'] } },
    { name: 'cellSubtitleColor', type: 'color', variations: ['view'], params: { web: ['cellSubtitleColor'] } },
    { name: 'cellColor', type: 'color', variations: ['view'], params: { web: ['cellColor'] } },
    { name: 'cellPaddingLeftContent', type: 'dimension', variations: ['size'], params: { web: ['cellPaddingLeftContent'] } },
    { name: 'cellTextboxGap', type: 'dimension', variations: ['size'], params: { web: ['cellTextboxGap'] } },
    { name: 'cellLabelColor', type: 'color', variations: ['view'], params: { web: ['cellLabelColor'] } },
    { name: 'cellSubtitleStyle', type: 'typography', variations: ['size'], params: { web: ['cellSubtitleFontSize', 'cellSubtitleLetterSpacing', 'cellSubtitleFontFamily', 'cellSubtitleFontStyle', 'cellSubtitleFontWeight', 'cellSubtitleLineHeight'] } },
    { name: 'cellBackgroundColor', type: 'color', variations: ['view'], params: { web: ['cellBackgroundColor'] } },
    { name: 'cellPaddingContent', type: 'dimension', variations: ['size'], params: { web: ['cellPaddingContent'] } },
];
