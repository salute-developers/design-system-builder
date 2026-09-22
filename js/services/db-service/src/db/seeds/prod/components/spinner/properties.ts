import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'color', type: 'color', variations: ['view'], params: { web: ['color'] } },
    { name: 'size', type: 'dimension', variations: ['size'], params: { web: ['size'] } },
];
