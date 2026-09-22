import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'background', type: 'color', variations: ['view'], params: { web: ['background'] } },
    { name: 'backgroundHover', type: 'color', variations: ['view'], params: { web: ['backgroundHover'] } },
    { name: 'overlayColorActive', type: 'color', variations: ['view'], params: { web: ['overlayColorActive'] } },
    { name: 'borderColor', type: 'color', variations: ['view'], params: { web: ['borderColor'] } },
    { name: 'borderColorActive', type: 'color', variations: ['view'], params: { web: ['borderColorActive'] } },
    { name: 'titleColor', type: 'color', variations: ['view'], params: { web: ['titleColor'] } },
    { name: 'descriptionColor', type: 'color', variations: ['view'], params: { web: ['descriptionColor'] } },
    { name: 'titleStyle', type: 'typography', variations: ['size'], params: { web: ['titleFontFamily', 'titleFontSize', 'titleFontStyle', 'titleFontWeight', 'titleLetterSpacing', 'titleLineHeight'] } },
    { name: 'descriptionStyle', type: 'typography', variations: ['size'], params: { web: ['descriptionFontFamily', 'descriptionFontSize', 'descriptionFontStyle', 'descriptionFontWeight', 'descriptionLetterSpacing', 'descriptionLineHeight'] } },
    { name: 'padding', type: 'dimension', variations: ['size'], params: { web: ['padding'] } },
    { name: 'contentWrapperGap', type: 'dimension', variations: ['size'], params: { web: ['contentWrapperGap'] } },
    { name: 'contentGap', type: 'dimension', variations: ['size'], params: { web: ['contentGap'] } },
    { name: 'contentColumnGap', type: 'dimension', variations: ['size'], params: { web: ['contentColumnGap'] } },
    { name: 'disabledOpacity', type: 'float', params: { web: ['disabledOpacity'] } },
    { name: 'borderRadius', type: 'shape', variations: ['size'], params: { web: ['borderRadius'] } },
    { name: 'borderColorHover', type: 'color', variations: ['view'], params: { web: ['borderColorHover'] } },
];
