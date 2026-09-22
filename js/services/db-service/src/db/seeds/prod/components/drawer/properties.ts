import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'padding', type: 'dimension', variations: ['size'], params: { web: ['padding'] } },
    { name: 'background', type: 'color', variations: ['view'], params: { web: ['background'] } },
    { name: 'shadow', type: 'value', variations: ['view'], params: { web: ['shadow'] } },
    { name: 'contentBackgroundColor', type: 'color', variations: ['view'], params: { web: ['contentBackgroundColor'] } },
    { name: 'drawerOverlayWithBlurColor', type: 'color', variations: ['view'], params: { web: ['drawerOverlayWithBlurColor'] } },
    { name: 'drawerOverlayColor', type: 'color', variations: ['view'], params: { web: ['drawerOverlayColor'] } },
    { name: 'borderRadius', type: 'dimension', variations: ['borderRadius'], params: { web: ['borderRadius'] } },
];
