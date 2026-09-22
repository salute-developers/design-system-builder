import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'sheetOverlayColor', type: 'color', variations: ['view'], params: { web: ['sheetOverlayColor'] } },
    { name: 'sheetOverlayWithBlurColor', type: 'color', variations: ['view'], params: { web: ['sheetOverlayWithBlurColor'] } },
    { name: 'contentBackgroundColor', type: 'color', variations: ['view'], params: { web: ['contentBackgroundColor'] } },
    { name: 'handleBackgroundColor', type: 'color', variations: ['view'], params: { web: ['handleBackgroundColor'] } },
    { name: 'handleMarginTop', type: 'dimension', variations: ['handlePlacement'], params: { web: ['handleMarginTop'] } },
];
