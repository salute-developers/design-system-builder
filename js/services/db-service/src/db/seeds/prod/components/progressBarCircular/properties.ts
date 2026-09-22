import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'strokeWidth', type: 'dimension', variations: ['size'], params: { web: ['strokeWidth'] } },
    { name: 'contentColor', type: 'color', variations: ['view'], params: { web: ['contentColor'] } },
    { name: 'strokeSize', type: 'float', variations: ['size'], params: { web: ['strokeSize'] } },
    { name: 'backgroundStroke', type: 'color', variations: ['view'], params: { web: ['backgroundStroke'] } },
    { name: 'progressStroke', type: 'color', variations: ['view'], params: { web: ['progressStroke'] } },
    { name: 'contentStyle', type: 'typography', variations: ['size'], params: { web: ['contentFontFamily', 'contentFontSize', 'contentFontStyle', 'contentFontWeight', 'contentLetterSpacing', 'contentLineHeight'] } },
    { name: 'size', type: 'float', variations: ['size'], params: { web: ['size'] } },
    { name: 'height', type: 'dimension', variations: ['size'], params: { web: ['height'] } },
    { name: 'width', type: 'dimension', variations: ['size'], params: { web: ['width'] } },
];
