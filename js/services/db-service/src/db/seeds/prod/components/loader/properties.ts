import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'progressBarCircularStroke', type: 'color', variations: ['view'], params: { web: ['progressBarCircularStroke'] } },
    { name: 'progressBarCircularBackgroundStroke', type: 'color', variations: ['view'], params: { web: ['progressBarCircularBackgroundStroke'] } },
    { name: 'progressBarCircularContentColor', type: 'color', variations: ['view'], params: { web: ['progressBarCircularContentColor'] } },
    { name: 'spinnerColor', type: 'color', variations: ['view'], params: { web: ['spinnerColor'] } },
    { name: 'overlayColor', type: 'color', variations: ['view'], params: { web: ['overlayColor'] } },
    { name: 'width', type: 'value', variations: ['size'], params: { web: ['width'] } },
    { name: 'height', type: 'value', variations: ['size'], params: { web: ['height'] } },
    { name: 'progressBarCircularContentStyle', type: 'typography', variations: ['size'], params: { web: ['progressBarCircularContentFontFamily', 'progressBarCircularContentFontSize', 'progressBarCircularContentFontStyle', 'progressBarCircularContentFontWeight', 'progressBarCircularContentLetterSpacing', 'progressBarCircularContentLineHeight'] } },
    { name: 'progressBarCircularSize', type: 'float', variations: ['size'], params: { web: ['progressBarCircularSize'] } },
    { name: 'progressBarCircularHeight', type: 'dimension', variations: ['size'], params: { web: ['progressBarCircularHeight'] } },
    { name: 'progressBarCircularWidth', type: 'dimension', variations: ['size'], params: { web: ['progressBarCircularWidth'] } },
    { name: 'progressBarCircularStrokeWidth', type: 'dimension', variations: ['size'], params: { web: ['progressBarCircularStrokeWidth'] } },
    { name: 'progressBarCircularStrokeSize', type: 'float', variations: ['size'], params: { web: ['progressBarCircularStrokeSize'] } },
    { name: 'spinnerSize', type: 'dimension', variations: ['size'], params: { web: ['spinnerSize'] } },
];
