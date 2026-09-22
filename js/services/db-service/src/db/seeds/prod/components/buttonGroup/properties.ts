import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'buttonValueColor', type: 'color', variations: ['view'], params: { web: ['buttonValueColor'] } },
    { name: 'buttonBackgroundColor', type: 'color', variations: ['view'], params: { web: ['buttonBackgroundColor'] } },
    { name: 'buttonLoadingBackgroundColor', type: 'value', variations: ['view'], params: { web: ['buttonLoadingBackgroundColor'] } },
    { name: 'buttonColorHover', type: 'color', variations: ['view'], params: { web: ['buttonColorHover'] } },
    { name: 'buttonBackgroundColorHover', type: 'color', variations: ['view'], params: { web: ['buttonBackgroundColorHover'] } },
    { name: 'buttonColorActive', type: 'color', variations: ['view'], params: { web: ['buttonColorActive'] } },
    { name: 'buttonBackgroundColorActive', type: 'color', variations: ['view'], params: { web: ['buttonBackgroundColorActive'] } },
    { name: 'buttonStyle', type: 'typography', variations: ['size'], params: { web: ['buttonFontFamily', 'buttonFontSize', 'buttonFontStyle', 'buttonFontWeight', 'buttonLetterSpacing', 'buttonLineHeight'] } },
    { name: 'buttonGroupOrientation', type: 'value', variations: ['orientation'], params: { web: ['buttonGroupOrientation'] } },
    { name: 'buttonHeight', type: 'dimension', variations: ['size'], params: { web: ['buttonHeight'] } },
    { name: 'buttonPadding', type: 'dimension', variations: ['size'], params: { web: ['buttonPadding'] } },
    { name: 'buttonGroupItemsGap', type: 'dimension', variations: ['gap'], params: { web: ['buttonGroupItemsGap'] } },
    { name: 'buttonDefaultRadius', type: 'dimension', variations: ['size'], params: { web: ['buttonDefaultRadius'] } },
    { name: 'buttonSegmentedRadius', type: 'dimension', variations: ['size'], params: { web: ['buttonSegmentedRadius'] } },
    { name: 'buttonSideRadius', type: 'dimension', variations: ['size'], params: { web: ['buttonSideRadius'] } },
    { name: 'buttonColor', type: 'color', variations: ['view'], params: { web: ['buttonColor'] } },
    { name: 'buttonTextColor', type: 'color', variations: ['view'], params: { web: ['buttonTextColor'] } },
    { name: 'buttonIconColor', type: 'color', variations: ['view'], params: { web: ['buttonIconColor'] } },
];
