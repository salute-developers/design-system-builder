import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'boxShadow', type: 'shadow', variations: ['view'], params: { web: ['boxShadow'] } },
    { name: 'arrowMaskImage', type: 'value', variations: ['view'], params: { web: ['arrowMaskImage'] } },
    { name: 'arrowBackground', type: 'color', variations: ['view'], params: { web: ['arrowBackground'] } },
    { name: 'arrowMaskWidth', type: 'dimension', variations: ['view'], params: { web: ['arrowMaskWidth'] } },
    { name: 'arrowMaskHeight', type: 'dimension', variations: ['view'], params: { web: ['arrowMaskHeight'] } },
    { name: 'arrowHeight', type: 'dimension', variations: ['view'], params: { web: ['arrowHeight'] } },
    { name: 'arrowEdgeMargin', type: 'dimension', variations: ['view'], params: { web: ['arrowEdgeMargin'] } },
];
