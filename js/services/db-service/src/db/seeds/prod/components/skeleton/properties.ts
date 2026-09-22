import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'visibleLineHeight', type: 'dimension', variations: ['size'], params: { web: ['visibleLineHeight'] } },
    { name: 'pulseDuration', type: 'float', params: { web: ['pulseDuration'] } },
    { name: 'fadeOutColor', type: 'color', variations: ['view'], params: { web: ['fadeOutColor'] } },
    { name: 'shimmerDuration', type: 'float', params: { web: ['shimmerDuration'] } },
    { name: 'gradientColor', type: 'color', params: { web: ['gradientColor'] } },
    { name: 'fadeInColor', type: 'color', variations: ['view'], params: { web: ['fadeInColor'] } },
    { name: 'lineHeight', type: 'typography', variations: ['size'], params: { web: ['lineHeight'] } },
];
