import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'solidBackground', type: 'color', variations: ['view'], params: { web: ['solidBackground'] } },
    { name: 'outlineWidth', type: 'dimension', variations: ['size'], params: { web: ['outlineWidth'] } },
    { name: 'borderWidth', type: 'dimension', variations: ['size'], params: { web: ['borderWidth'] } },
    { name: 'borderRadius', type: 'dimension', variations: ['size'], params: { web: ['borderRadius'] } },
    { name: 'contentBorderRadius', type: 'shape', variations: ['size'], params: { web: ['contentBorderRadius'] } },
];
