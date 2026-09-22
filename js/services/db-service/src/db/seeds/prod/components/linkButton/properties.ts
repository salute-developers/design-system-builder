import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'linkButtonHeight', type: 'dimension', variations: ['size'], params: { web: ['linkButtonHeight'] } },
    { name: 'linkButtonTextPadding', type: 'dimension', variations: ['size'], params: { web: ['linkButtonTextPadding'] } },
    { name: 'linkButtonBackgroundColor', type: 'color', variations: ['view'], params: { web: ['linkButtonBackgroundColor'] } },
    { name: 'linkButtonAdditionalContentMargin', type: 'dimension', variations: ['size'], params: { web: ['linkButtonAdditionalContentMargin'] } },
    { name: 'linkButtonSpinnerColor', type: 'color', variations: ['view'], params: { web: ['linkButtonSpinnerColor'] } },
    { name: 'linkButtonLeftContentMargin', type: 'dimension', variations: ['size'], params: { web: ['linkButtonLeftContentMargin'] } },
    { name: 'linkButtonSpinnerSize', type: 'dimension', variations: ['size'], params: { web: ['linkButtonSpinnerSize'] } },
    { name: 'linkButtonDisabledAlpha', type: 'float', params: { web: ['linkButtonDisabledOpacity'] } },
    { name: 'linkButtonColor', type: 'color', variations: ['view'], params: { web: ['linkButtonColor'] } },
    { name: 'linkButtonTextColor', type: 'color', variations: ['view'], params: { web: ['linkButtonTextColor'] } },
    { name: 'linkButtonPadding', type: 'dimension', variations: ['size'], params: { web: ['linkButtonPadding'] } },
    { name: 'linkButtonRadius', type: 'shape', variations: ['size'], params: { web: ['linkButtonRadius'] } },
    { name: 'linkButtonRightContentMargin', type: 'dimension', variations: ['size'], params: { web: ['linkButtonRightContentMargin'] } },
    { name: 'linkButtonFocusColor', type: 'color', params: { web: ['linkButtonFocusColor'] } },
    { name: 'textStyle', type: 'typography', variations: ['size'], params: { web: ['linkButtonFontSize', 'linkButtonLetterSpacing', 'linkButtonFontStyle', 'linkButtonFontFamily', 'linkButtonFontWeight', 'linkButtonLineHeight'] } },
    { name: 'linkButtonIconColor', type: 'color', variations: ['view'], params: { web: ['linkButtonIconColor'] } },
];
