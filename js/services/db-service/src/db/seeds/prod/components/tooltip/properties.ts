import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'color', type: 'color', variations: ['view'], params: { web: ['color'] } },
    { name: 'arrowHeight', type: 'dimension', variations: ['size'], params: { web: ['arrowHeight'] } },
    { name: 'arrowEdgeMargin', type: 'dimension', variations: ['size'], params: { web: ['arrowEdgeMargin'] } },
    { name: 'borderRadius', type: 'dimension', variations: ['size'], params: { web: ['borderRadius'] } },
    { name: 'textStyle', type: 'typography', variations: ['size'], params: { web: ['textFontFamily', 'textFontSize', 'textFontStyle', 'textFontWeight', 'textFontLetterSpacing', 'textFontLineHeight'] } },
    { name: 'arrowMaskImage', type: 'value', variations: ['size'], params: { web: ['arrowMaskImage'] } },
    { name: 'arrowBackground', type: 'color', variations: ['size'], params: { web: ['arrowBackground'] } },
    { name: 'backgroundColor', type: 'color', variations: ['view'], params: { web: ['backgroundColor'] } },
    { name: 'boxShadow', type: 'value', variations: ['view'], params: { web: ['boxShadow'] } },
    { name: 'paddingTop', type: 'dimension', variations: ['size'], params: { web: ['paddingTop'] } },
    { name: 'paddingRight', type: 'dimension', variations: ['size'], params: { web: ['paddingRight'] } },
    { name: 'paddingLeft', type: 'dimension', variations: ['size'], params: { web: ['paddingLeft'] } },
    { name: 'minHeight', type: 'dimension', variations: ['size'], params: { web: ['minHeight'] } },
    { name: 'contentLeftMargin', type: 'dimension', variations: ['size'], params: { web: ['contentLeftMargin'] } },
    { name: 'arrowMaskWidth', type: 'dimension', variations: ['size'], params: { web: ['arrowMaskWidth'] } },
    { name: 'arrowMaskHeight', type: 'dimension', variations: ['size'], params: { web: ['arrowMaskHeight'] } },
    { name: 'paddingBottom', type: 'dimension', variations: ['size'], params: { web: ['paddingBottom'] } },
];
