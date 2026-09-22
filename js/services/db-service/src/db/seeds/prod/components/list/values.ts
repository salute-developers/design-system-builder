import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    size: {
        m: [
            { prop: 'listItemBorderWidth', value: '0' },
            { prop: 'listItemBorderRadius', token: 'round.m' },
            { prop: 'listItemGap', value: '8' },
            { prop: 'listItemPaddingLeft', value: '14' },
            { prop: 'listItemPaddingTop', value: '12' },
            { prop: 'listItemTightDifference', value: '4' },
            { prop: 'listItemPaddingBottom', value: '12' },
            { prop: 'listItemPaddingRight', value: '14' },
            { prop: 'listItemStyle', value: 'body.m.normal' },
        ],
        l: [
            { prop: 'listItemBorderRadius', token: 'round.l' },
            { prop: 'listItemGap', value: '8' },
            { prop: 'listItemPaddingLeft', value: '16' },
            { prop: 'listItemPaddingTop', value: '16' },
            { prop: 'listItemTightDifference', value: '4' },
            { prop: 'listItemBorderWidth', value: '0' },
            { prop: 'listItemPaddingBottom', value: '16' },
            { prop: 'listItemPaddingRight', value: '16' },
            { prop: 'listItemStyle', value: 'body.l.normal' },
        ],
        s: [
            { prop: 'listItemBorderWidth', value: '0' },
            { prop: 'listItemPaddingBottom', value: '11' },
            { prop: 'listItemPaddingRight', value: '12' },
            { prop: 'listItemStyle', value: 'body.s.normal' },
            { prop: 'listItemBorderRadius', token: 'round.s' },
            { prop: 'listItemGap', value: '6' },
            { prop: 'listItemPaddingLeft', value: '12' },
            { prop: 'listItemPaddingTop', value: '11' },
            { prop: 'listItemTightDifference', value: '4' },
        ],
        xs: [
            { prop: 'listItemBorderRadius', token: 'round.s' },
            { prop: 'listItemGap', value: '6' },
            { prop: 'listItemPaddingLeft', value: '8' },
            { prop: 'listItemPaddingTop', value: '8' },
            { prop: 'listItemTightDifference', value: '4' },
            { prop: 'listItemBorderWidth', value: '0' },
            { prop: 'listItemPaddingBottom', value: '8' },
            { prop: 'listItemPaddingRight', value: '8' },
            { prop: 'listItemStyle', value: 'body.xs.normal' },
        ],
        xl: [
            { prop: 'listItemBorderRadius', token: 'round.l' },
            { prop: 'listItemGap', value: '8' },
            { prop: 'listItemPaddingLeft', value: '18' },
            { prop: 'listItemPaddingTop', value: '21' },
            { prop: 'listItemTightDifference', value: '4' },
            { prop: 'listItemBorderWidth', value: '0' },
            { prop: 'listItemPaddingBottom', value: '21' },
            { prop: 'listItemPaddingRight', value: '18' },
            { prop: 'listItemStyle', value: 'body.l.normal' },
        ],
    },
    view: {
        default: [
            { prop: 'listItemBackground', token: 'surface.default.clear' },
            { prop: 'listItemBackground', token: 'surface.default.transparent-secondary-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'listItemBackground', value: 'surface.default.transparent-secondary-hover' }] },
            { prop: 'listItemColor', token: 'text.default.primary' },
            { prop: 'listItemColor', token: 'text.default.primary-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'listItemColor', value: 'text.default.primary-hover' }] },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'listItemFocusColor', token: 'surface.default.accent' },
    { prop: 'listDisabledOpacity', value: '0.4' },
];
