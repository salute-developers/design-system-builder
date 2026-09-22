import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'typoFontWeightMedium', type: 'value', variations: ['size'], params: { web: ['typoFontWeightMedium'] } },
    { name: 'typoStyle', type: 'typography', variations: ['size'], params: { web: ['typoFontFamily', 'typoFontSize', 'typoFontStyle', 'typoFontWeight', 'typoFontLetterSpacing', 'typoFontLineHeight'] } },
    { name: 'typoFontWeightBold', type: 'value', variations: ['size'], params: { web: ['typoFontWeightBold'] } },
];
