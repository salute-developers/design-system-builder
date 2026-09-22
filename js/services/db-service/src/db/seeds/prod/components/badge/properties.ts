import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'colorClear', type: 'color', variations: ['view'], params: { web: ['colorClear'] } },
    { name: 'backgroundTransparent', type: 'color', variations: ['view'], params: { web: ['backgroundTransparent'] } },
    { name: 'padding', type: 'dimension', variations: ['size'], params: { web: ['padding'] } },
    { name: 'height', type: 'dimension', variations: ['size'], params: { web: ['height'] } },
    { name: 'shape', type: 'shape', variations: ['size', 'shape'], params: { web: ['borderRadius'] } },
    { name: 'backgroundClear', type: 'color', params: { web: ['backgroundClear'] } },
    { name: 'leftContentMarginRight', type: 'dimension', variations: ['size'], params: { web: ['leftContentMarginRight'] } },
    { name: 'rightContentMarginLeft', type: 'dimension', variations: ['size'], params: { web: ['rightContentMarginLeft'] } },
    { name: 'textStyle', type: 'typography', variations: ['size'], params: { web: ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight'] } },
    { name: 'leftContentMarginLeft', type: 'dimension', variations: ['size'], params: { web: ['leftContentMarginLeft'] } },
    { name: 'rightContentMarginRight', type: 'dimension', variations: ['size'], params: { web: ['rightContentMarginRight'] } },
    { name: 'background', type: 'color', variations: ['view'], params: { web: ['background'] } },
    { name: 'color', type: 'color', variations: ['view'], params: { web: ['color'] } },
    { name: 'paddingIconOnly', type: 'dimension', variations: ['size'], params: { web: ['paddingIconOnly'] } },
    { name: 'colorTransparent', type: 'color', variations: ['view'], params: { web: ['colorTransparent'] } },
];
