import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'closeIconButtonSize', type: 'dimension', variations: ['closeIconType'], params: { web: ['closeIconButtonSize'] } },
    { name: 'padding', type: 'dimension', variations: ['size'], params: { web: ['padding'] } },
    { name: 'contentLeftMargin', type: 'dimension', variations: ['size', 'shape'], params: { web: ['contentLeftMargin'] } },
    { name: 'closeIconMargin', type: 'dimension', variations: ['size', 'shape'], params: { web: ['closeIconMargin'] } },
    { name: 'closeIconSize', type: 'dimension', variations: ['closeIconType'], params: { web: ['closeIconSize'] } },
    { name: 'borderRadius', type: 'shape', variations: ['size'], params: { web: ['borderRadius'] } },
    { name: 'pilledBorderRadius', type: 'dimension', variations: ['shape'], params: { web: ['pilledBorderRadius'] } },
    { name: 'color', type: 'color', variations: ['view'], params: { web: ['color'] } },
    { name: 'background', type: 'color', variations: ['view'], params: { web: ['background'] } },
    { name: 'closeIconColor', type: 'color', variations: ['view'], params: { web: ['closeIconColor'] } },
    { name: 'closeIconColorOnHover', type: 'color', variations: ['view'], params: { web: ['closeIconColorOnHover'] } },
    { name: 'contentLeftColor', type: 'color', variations: ['view'], params: { web: ['contentLeftColor'] } },
    { name: 'maxWidth', type: 'value', variations: ['size'], params: { web: ['maxWidth'] } },
    { name: 'textStyle', type: 'typography', variations: ['size'], params: { web: ['fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing', 'lineHeight'] } },
];
