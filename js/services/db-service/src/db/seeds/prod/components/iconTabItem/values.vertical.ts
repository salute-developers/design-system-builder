import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        divider: [
            { prop: 'itemColor', token: 'text.default.secondary' },
            { prop: 'itemBackgroundColor', value: 'transparent' },
            { prop: 'itemColorHover', token: 'text.default.secondary-hover' },
            { prop: 'itemColorActive', token: 'text.default.secondary-active' },
            { prop: 'itemBackgroundColorHover', value: 'transparent' },
            { prop: 'itemSelectedColor', token: 'text.default.primary' },
            { prop: 'itemSelectedBackgroundColor', value: 'transparent' },
            { prop: 'itemSelectedColorHover', token: 'text.default.primary' },
            { prop: 'itemSelectedBackgroundColorHover', value: 'transparent' },
            { prop: 'itemBackgroundTransition', value: 'background-color 0.3s ease-in-out' },
            { prop: 'outlineFocusColor', token: 'surface.default.accent' },
            { prop: 'itemSelectedDividerColor', token: 'text.default.primary' },
            { prop: 'itemSelectedDividerColorHover', token: 'text.default.primary' },
            { prop: 'itemCursor', value: 'pointer' },
            { prop: 'itemSelectedDividerWidth', value: '2' },
        ],
    },
    size: {
        xs: [
            { prop: 'itemContentGap', value: '4' },
            { prop: 'itemContentPadding', value: '2' },
            { prop: 'actionContentMarginLeft', value: '0' },
            { prop: 'itemBorderRadius', value: '6' },
            { prop: 'itemPaddingOrientationVertical', value: '8', adjust: [{ platform: 'web', param: 'itemPaddingOrientationVertical', template: '$1 0.625rem' }] },
        ],
        s: [
            { prop: 'itemContentGap', value: '4' },
            { prop: 'itemContentPadding', value: '2' },
            { prop: 'actionContentMarginLeft', value: '4' },
            { prop: 'itemBorderRadius', value: '8' },
            { prop: 'itemPaddingOrientationVertical', value: '8', adjust: [{ platform: 'web', param: 'itemPaddingOrientationVertical', template: '$1 0.625rem' }] },
        ],
        m: [
            { prop: 'itemContentGap', value: '6' },
            { prop: 'itemContentPadding', value: '2' },
            { prop: 'actionContentMarginLeft', value: '2' },
            { prop: 'itemBorderRadius', value: '10' },
            { prop: 'itemPaddingOrientationVertical', value: '12', adjust: [{ platform: 'web', param: 'itemPaddingOrientationVertical', template: '$1 0.625rem' }] },
        ],
        l: [
            { prop: 'itemContentGap', value: '8' },
            { prop: 'itemContentPadding', value: '2' },
            { prop: 'actionContentMarginLeft', value: '2' },
            { prop: 'itemBorderRadius', value: '12' },
            { prop: 'itemPaddingOrientationVertical', value: '16', adjust: [{ platform: 'web', param: 'itemPaddingOrientationVertical', template: '$1 0.625rem' }] },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'disabledOpacity', value: '0.4' },
];
