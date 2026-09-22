import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'background', type: 'color', variations: ['view'], params: { web: ['background'] } },
    { name: 'labelStyle', type: 'typography', variations: ['size'], params: { web: ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight'] } },
    { name: 'shape', type: 'shape', variations: ['size'], params: { web: ['borderRadius'] } },
    { name: 'height', type: 'dimension', variations: ['size'], params: { web: ['height'] } },
    { name: 'padding', type: 'dimension', variations: ['size'], params: { web: ['padding'] } },
    { name: 'color', type: 'color', variations: ['view'], params: { web: ['color'] } },
];
