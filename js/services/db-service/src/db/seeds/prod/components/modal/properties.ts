import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'modalCloseButtonHoverColor', type: 'color', variations: ['view'], params: { web: ['modalCloseButtonHoverColor'] } },
    { name: 'modalCloseButtonActiveColor', type: 'color', variations: ['view'], params: { web: ['modalCloseButtonActiveColor'] } },
    { name: 'modalOutlineFocusColor', type: 'color', variations: ['view'], params: { web: ['modalOutlineFocusColor'] } },
    { name: 'modalBodyPadding', type: 'dimension', variations: ['view'], params: { web: ['modalBodyPadding'] } },
    { name: 'modalContentPadding', type: 'dimension', variations: ['view'], params: { web: ['modalContentPadding'] } },
    { name: 'modalBodyBorderRadius', type: 'shape', variations: ['view'], params: { web: ['modalBodyBorderRadius'] } },
    { name: 'modalCloseButtonRadius', type: 'shape', variations: ['view'], params: { web: ['modalCloseButtonRadius'] } },
    { name: 'modalOverlayWithBlurColor', type: 'color', variations: ['view'], params: { web: ['modalOverlayWithBlurColor'] } },
    { name: 'modalOverlayColor', type: 'color', variations: ['view'], params: { web: ['modalOverlayColor'] } },
    { name: 'modalBodyBackground', type: 'color', variations: ['view'], params: { web: ['modalBodyBackground'] } },
    { name: 'modalCloseButtonColor', type: 'color', variations: ['view'], params: { web: ['modalCloseButtonColor'] } },
];
