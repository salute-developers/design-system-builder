import type { PropertySeed } from '../../component-seed';

export const properties: PropertySeed[] = [
    { name: 'arrowColor', type: 'color', variations: ['view'], params: { web: ['arrowColor'] } },
    { name: 'arrowColorHover', type: 'color', variations: ['view'], params: { web: ['arrowColorHover'] } },
    { name: 'arrowColorActive', type: 'color', variations: ['view'], params: { web: ['arrowColorActive'] } },
    { name: 'tabsBackgroundColor', type: 'color', variations: ['view'], params: { web: ['tabsBackgroundColor'] } },
    { name: 'outlineFocusColor', type: 'color', variations: ['view'], params: { web: ['outlineFocusColor'] } },
    { name: 'tabsDividerColor', type: 'color', variations: ['view'], params: { web: ['tabsDividerColor'] } },
    { name: 'tabsWidth', type: 'value', variations: ['size'], params: { web: ['tabsWidth'] } },
    { name: 'tabsHeight', type: 'value', variations: ['size'], params: { web: ['tabsHeight'] } },
    { name: 'containerWidth', type: 'value', variations: ['stretch'], params: { web: ['containerWidth'] } },
    { name: 'tabsDividerHeight', type: 'dimension', variations: ['view'], params: { web: ['tabsDividerHeight'] } },
    { name: 'arrowInnerPadding', type: 'dimension', variations: ['size'], params: { web: ['arrowInnerPadding'] } },
    { name: 'arrowOuterPadding', type: 'dimension', variations: ['size'], params: { web: ['arrowOuterPadding'] } },
    { name: 'disabledOpacity', type: 'float', params: { web: ['disabledOpacity'] } },
    { name: 'tabsDividerBorderRadius', type: 'dimension', variations: ['view'], params: { web: ['tabsDividerBorderRadius'] } },
    { name: 'tabsBorderRadius', type: 'dimension', variations: ['size'], params: { web: ['tabsBorderRadius'] } },
    { name: 'tabsPilledBorderRadius', type: 'dimension', variations: ['pilled'], params: { web: ['tabsPilledBorderRadius'] } },
    { name: 'containerHeight', type: 'value', variations: ['stretch'], params: { web: ['containerHeight'] } },
    { name: 'tabsDividerWidth', type: 'dimension', variations: ['view'], params: { web: ['tabsDividerWidth'] } },
];
