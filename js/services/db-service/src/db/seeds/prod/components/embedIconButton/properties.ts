import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'embedIconButtonSpinnerSize', type: 'dimension', variations: ['size'], params: { web: ['embedIconButtonSpinnerSize'] } },
    { name: 'embedIconButtonWidth', type: 'dimension', variations: ['size'], params: { web: ['embedIconButtonWidth'] } },
    { name: 'textStyle', type: 'typography', variations: ['size'], params: { web: ['embedIconButtonFontFamily', 'embedIconButtonFontSize', 'embedIconButtonLineHeight', 'embedIconButtonLetterSpacing', 'embedIconButtonFontStyle', 'embedIconButtonFontWeight'] } },
    { name: 'embedIconButtonBackgroundColor', type: 'color', variations: ['view'], params: { web: ['embedIconButtonBackgroundColor'] } },
    { name: 'embedIconButtonColor', type: 'color', variations: ['view'], params: { web: ['embedIconButtonColor'] } },
    { name: 'embedIconButtonDisabledAlpha', type: 'float', params: { web: ['embedIconButtonDisabledOpacity'] } },
    { name: 'embedIconButtonFocusColor', type: 'color', params: { web: ['embedIconButtonFocusColor'] } },
    { name: 'embedIconButtonHeight', type: 'dimension', variations: ['size'], params: { web: ['embedIconButtonHeight'] } },
    { name: 'embedIconButtonLoadingBackgroundColor', type: 'color', variations: ['view'], params: { web: ['embedIconButtonLoadingBackgroundColor'] } },
    { name: 'embedIconButtonPadding', type: 'dimension', variations: ['size'], params: { web: ['embedIconButtonPadding'] } },
    { name: 'embedIconButtonRadius', type: 'shape', variations: ['size'], params: { web: ['embedIconButtonRadius'] } },
    { name: 'embedIconButtonSpinnerColor', type: 'color', variations: ['view'], params: { web: ['embedIconButtonSpinnerColor'] } },
];
