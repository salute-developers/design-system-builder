import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'completedIndicatorColor', type: 'color', variations: ['view'], params: { web: ['completedIndicatorColor'] } },
    { name: 'completedIndicatorColorHover', type: 'color', variations: ['view'], params: { web: ['completedIndicatorColorHover'] } },
    { name: 'completedIndicatorBackground', type: 'color', variations: ['view'], params: { web: ['completedIndicatorBackground'] } },
    { name: 'completedIndicatorBackgroundHover', type: 'color', variations: ['view'], params: { web: ['completedIndicatorBackgroundHover'] } },
    { name: 'completedTitleColor', type: 'color', variations: ['view'], params: { web: ['completedTitleColor'] } },
    { name: 'completedTitleColorHover', type: 'color', variations: ['view'], params: { web: ['completedTitleColorHover'] } },
    { name: 'dividerColor', type: 'color', variations: ['view'], params: { web: ['dividerColor'] } },
];
