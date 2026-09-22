import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'background', type: 'color', variations: ['view'], params: { web: ['background'] } },
    { name: 'baseSideSize', type: 'dimension', variations: ['orientation'], params: { web: ['baseSideSize'] } },
    { name: 'borderRadius', type: 'shape', variations: ['size'], params: { web: ['borderRadius'] } },
];
