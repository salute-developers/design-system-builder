import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        divider: [
            { prop: 'arrowColor', token: 'text.default.secondary' },
            { prop: 'arrowColorHover', token: 'text.default.secondary-hover' },
            { prop: 'arrowColorActive', token: 'text.default.secondary-active' },
            { prop: 'tabsBackgroundColor', value: 'transparent' },
            { prop: 'outlineFocusColor', token: 'surface.default.accent' },
            { prop: 'tabsDividerColor', token: 'surface.default.transparent-tertiary' },
            { prop: 'tabsDividerWidth', value: '1' },
            { prop: 'tabsDividerHeight', value: '1' },
            { prop: 'tabsDividerBorderRadius', value: '1' },
        ],
    },
    size: {
        xs: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '0' },
            { prop: 'arrowOuterPadding', value: '2' },
            { prop: 'tabsBorderRadius', value: '8' },
        ],
        s: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '0' },
            { prop: 'arrowOuterPadding', value: '4' },
            { prop: 'tabsBorderRadius', value: '10' },
        ],
        m: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '0' },
            { prop: 'arrowOuterPadding', value: '10' },
            { prop: 'tabsBorderRadius', value: '12' },
        ],
        l: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '0' },
            { prop: 'arrowOuterPadding', value: '12' },
            { prop: 'tabsBorderRadius', value: '12' },
        ],
    },
    stretch: {
        true: [
            { prop: 'containerHeight', value: '100%' },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'disabledOpacity', value: '0.4' },
];
