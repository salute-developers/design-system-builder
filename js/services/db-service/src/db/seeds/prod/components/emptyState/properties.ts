import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'borderRadius', type: 'shape', variations: ['size'], params: { web: ['borderRadius'] } },
    { name: 'buttonHeight', type: 'dimension', variations: ['size'], params: { web: ['buttonHeight'] } },
    { name: 'buttonMargin', type: 'dimension', variations: ['size'], params: { web: ['buttonMargin'] } },
    { name: 'descriptionMargin', type: 'dimension', variations: ['size'], params: { web: ['descriptionMargin'] } },
    { name: 'iconMargin', type: 'dimension', variations: ['size'], params: { web: ['iconMargin'] } },
    { name: 'padding', type: 'dimension', variations: ['size'], params: { web: ['padding'] } },
    { name: 'textStyle', type: 'typography', variations: ['size'], params: { web: ['fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 'fontLetterSpacing', 'fontLineHeight'] } },
];
