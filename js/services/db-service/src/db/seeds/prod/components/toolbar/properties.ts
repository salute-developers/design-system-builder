import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'boxShadow', type: 'value', variations: ['view'], params: { web: ['boxShadow'] } },
    { name: 'background', type: 'color', variations: ['view'], params: { web: ['background'] } },
    { name: 'dividerColor', type: 'color', variations: ['view'], params: { web: ['dividerColor'] } },
    { name: 'size', type: 'dimension', variations: ['size'], params: { web: ['size'] } },
    { name: 'padding', type: 'dimension', variations: ['size'], params: { web: ['padding'] } },
    { name: 'dividerSize', type: 'dimension', variations: ['size'], params: { web: ['dividerSize'] } },
    { name: 'dividerOffset', type: 'dimension', variations: ['size'], params: { web: ['dividerOffset'] } },
    { name: 'borderRadius', type: 'dimension', variations: ['size'], params: { web: ['borderRadius'] } },
    { name: 'dividerBorderRadius', type: 'dimension', variations: ['size'], params: { web: ['dividerBorderRadius'] } },
];
