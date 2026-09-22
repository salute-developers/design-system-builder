import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'color', type: 'color', variations: ['view'], params: { web: ['color'] } },
    { name: 'iconMarginBottom', type: 'dimension', variations: ['size'], params: { web: ['iconMarginBottom'] } },
    { name: 'singleIconMarginBottom', type: 'dimension', variations: ['size'], params: { web: ['singleIconMarginBottom'] } },
    { name: 'actualIconSize', type: 'dimension', variations: ['size'], params: { web: ['actualIconSize'] } },
    { name: 'scaleFactor', type: 'float', variations: ['size'], params: { web: ['scaleFactor'] } },
    { name: 'wrapperGap', type: 'dimension', variations: ['size'], params: { web: ['wrapperGap'] } },
    { name: 'helperTextColor', type: 'color', variations: ['view'], params: { web: ['helperTextColor'] } },
    { name: 'iconColor', type: 'color', variations: ['view'], params: { web: ['iconColor'] } },
    { name: 'outlineIconColor', type: 'color', variations: ['view'], params: { web: ['outlineIconColor'] } },
    { name: 'gap', type: 'dimension', variations: ['size'], params: { web: ['gap'] } },
    { name: 'textStyle', type: 'typography', variations: ['size'], params: { web: ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight'] } },
    { name: 'helperTextStyle', type: 'typography', variations: ['size'], params: { web: ['helperTextFontFamily', 'helperTextFontSize', 'helperTextFontStyle', 'helperTextFontWeight', 'helperTextLetterSpacing', 'helperTextLineHeight'] } },
    { name: 'contentGap', type: 'dimension', variations: ['size'], params: { web: ['contentGap'] } },
    { name: 'singleIconContentGap', type: 'dimension', variations: ['size'], params: { web: ['singleIconContentGap'] } },
    { name: 'starsWrapperGap', type: 'dimension', variations: ['size'], params: { web: ['starsWrapperGap'] } },
    { name: 'iconSize', type: 'dimension', variations: ['size'], params: { web: ['iconSize'] } },
];
