import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'trackBackgroundColor', type: 'color', variations: ['view'], params: { web: ['trackBackgroundColor'] } },
    { name: 'progressFilledBackgroundColor', type: 'color', variations: ['view'], params: { web: ['progressFilledBackgroundColor'] } },
    { name: 'labelColor', type: 'color', variations: ['view'], params: { web: ['labelColor'] } },
    { name: 'labelIconColor', type: 'color', variations: ['view'], params: { web: ['labelIconColor'] } },
    { name: 'valueColor', type: 'color', variations: ['view'], params: { web: ['valueColor'] } },
    { name: 'captionColor', type: 'color', variations: ['view'], params: { web: ['captionColor'] } },
    { name: 'labelStyle', type: 'typography', variations: ['size'], params: { web: ['labelFontFamily', 'labelFontSize', 'labelFontStyle', 'labelFontWeight', 'labelLetterSpacing', 'labelLineHeight'] } },
    { name: 'valueStyle', type: 'typography', variations: ['size'], params: { web: ['valueFontFamily', 'valueFontSize', 'valueFontStyle', 'valueFontWeight', 'valueLetterSpacing', 'valueLineHeight'] } },
    { name: 'captionStyle', type: 'typography', variations: ['size'], params: { web: ['captionFontFamily', 'captionFontSize', 'captionFontStyle', 'captionFontWeight', 'captionLetterSpacing', 'captionLineHeight'] } },
    { name: 'topRowMarginBottom', type: 'dimension', variations: ['size'], params: { web: ['topRowMarginBottom'] } },
    { name: 'labelWrapperGap', type: 'dimension', variations: ['size'], params: { web: ['labelWrapperGap'] } },
    { name: 'labelWrapperMarginRight', type: 'dimension', variations: ['size'], params: { web: ['labelWrapperMarginRight'] } },
    { name: 'valueMarginLeft', type: 'dimension', variations: ['size'], params: { web: ['valueMarginLeft'] } },
    { name: 'captionMarginTop', type: 'dimension', variations: ['size'], params: { web: ['captionMarginTop'] } },
    { name: 'trackHeight', type: 'dimension', variations: ['progressSize'], params: { web: ['trackHeight'] } },
    { name: 'progressFilledHeight', type: 'dimension', variations: ['progressSize'], params: { web: ['progressFilledHeight'] } },
    { name: 'trackBorderRadius', type: 'shape', variations: ['progressSize'], params: { web: ['trackBorderRadius'] } },
    { name: 'progressFilledBorderRadius', type: 'shape', variations: ['progressSize'], params: { web: ['progressFilledBorderRadius'] } },
];
