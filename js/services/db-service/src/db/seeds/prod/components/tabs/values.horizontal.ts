import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        clear: [
            { prop: 'arrowColor', token: 'text.default.secondary' },
            { prop: 'arrowColorHover', token: 'text.default.secondary-hover' },
            { prop: 'arrowColorActive', token: 'text.default.secondary-active' },
            { prop: 'tabsBackgroundColor', value: 'transparent' },
            { prop: 'outlineFocusColor', token: 'surface.default.accent' },
            { prop: 'tabsDividerColor', value: 'transparent' },
            { prop: 'tabsDividerHeight', value: '0' },
            { prop: 'tabsDividerBorderRadius', value: '0' },
        ],
        filled: [
            { prop: 'arrowColor', token: 'text.default.secondary' },
            { prop: 'arrowColorHover', token: 'text.default.secondary-hover' },
            { prop: 'arrowColorActive', token: 'text.default.secondary-active' },
            { prop: 'tabsBackgroundColor', token: 'surface.default.transparent-primary' },
            { prop: 'outlineFocusColor', token: 'surface.default.accent' },
            { prop: 'tabsDividerColor', value: 'transparent' },
            { prop: 'tabsDividerHeight', value: '0' },
            { prop: 'tabsDividerBorderRadius', value: '0' },
        ],
        divider: [
            { prop: 'arrowColor', token: 'text.default.secondary' },
            { prop: 'arrowColorHover', token: 'text.default.secondary-hover' },
            { prop: 'arrowColorActive', token: 'text.default.secondary-active' },
            { prop: 'tabsBackgroundColor', value: 'transparent' },
            { prop: 'outlineFocusColor', token: 'surface.default.accent' },
            { prop: 'tabsDividerColor', token: 'surface.default.transparent-tertiary' },
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
            { prop: 'tabsBorderRadius', value: '14' },
        ],
        h6: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '4' },
            { prop: 'arrowOuterPadding', value: '0' },
            { prop: 'tabsBorderRadius', value: '8' },
        ],
        h5: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '4' },
            { prop: 'arrowOuterPadding', value: '0' },
            { prop: 'tabsBorderRadius', value: '8' },
        ],
        h4: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '4' },
            { prop: 'arrowOuterPadding', value: '0' },
            { prop: 'tabsBorderRadius', value: '8' },
        ],
        h3: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '6' },
            { prop: 'arrowOuterPadding', value: '0' },
            { prop: 'tabsBorderRadius', value: '10' },
        ],
        h2: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '8' },
            { prop: 'arrowOuterPadding', value: '0' },
            { prop: 'tabsBorderRadius', value: '12' },
        ],
        h1: [
            { prop: 'tabsWidth', value: 'fit-content' },
            { prop: 'tabsHeight', value: 'auto' },
            { prop: 'arrowInnerPadding', value: '16' },
            { prop: 'arrowOuterPadding', value: '0' },
            { prop: 'tabsBorderRadius', value: '12' },
        ],
    },
    stretch: {
        true: [
            { prop: 'containerWidth', value: '100%' },
        ],
    },
    pilled: {
        true: [
            { prop: 'tabsPilledBorderRadius', value: '26' },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'disabledOpacity', value: '0.4' },
];
