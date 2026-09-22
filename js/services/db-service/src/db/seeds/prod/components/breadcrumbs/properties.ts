import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'breadcrumbsColor', type: 'color', variations: ['view'], params: { web: ['breadcrumbsColor'] } },
    { name: 'breadcrumbsGap', type: 'dimension', variations: ['size'], params: { web: ['breadcrumbsGap'] } },
    { name: 'breadcrumbsColorText', type: 'color', variations: ['view'], params: { web: ['breadcrumbsColorText'] } },
    { name: 'breadcrumbsColorSeparator', type: 'color', variations: ['view'], params: { web: ['breadcrumbsColorSeparator'] } },
    { name: 'breadcrumbsFocusOutlineColor', type: 'color', variations: ['view'], params: { web: ['breadcrumbsFocusOutlineColor'] } },
    { name: 'breadcrumbsStyle', type: 'typography', variations: ['size'], params: { web: ['breadcrumbsFontFamily', 'breadcrumbsFontSize', 'breadcrumbsFontStyle', 'breadcrumbsFontWeight', 'breadcrumbsLetterSpacing', 'breadcrumbsLineHeight'] } },
    { name: 'breadcrumbsOpacity', type: 'float', variations: ['view'], params: { web: ['breadcrumbsOpacity'] } },
];
