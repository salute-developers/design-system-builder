import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'arrowColor', type: 'color', variations: ['view'], params: { web: ['arrowColor'] } },
    { name: 'groupBackgroundColor', type: 'color', variations: ['view'], params: { web: ['groupBackgroundColor'] } },
    { name: 'groupFilledBackgroundColor', type: 'color', variations: ['view', 'filledBackground'], params: { web: ['groupFilledBackgroundColor'] } },
    { name: 'groupWidth', type: 'value', variations: ['size'], params: { web: ['groupWidth'] } },
    { name: 'groupHeight', type: 'value', variations: ['size'], params: { web: ['groupHeight'] } },
    { name: 'disabledOpacity', type: 'float', params: { web: ['disabledOpacity'] } },
    { name: 'groupBorderRadius', type: 'dimension', variations: ['size'], params: { web: ['groupBorderRadius'] } },
    { name: 'groupPilledBorderRadius', type: 'dimension', variations: ['size'], params: { web: ['groupPilledBorderRadius'] } },
    { name: 'groupArrowPadding', type: 'dimension', variations: ['size'], params: { web: ['groupArrowPadding'] } },
    { name: 'groupVerticalArrowPadding', type: 'dimension', variations: ['size'], params: { web: ['groupVerticalArrowPadding'] } },
];
