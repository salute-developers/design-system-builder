import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        accent: [
            { prop: 'descriptionColor', token: 'text.default.secondary' },
            { prop: 'labelColor', token: 'text.default.primary' },
            { prop: 'toggleBorderColor', token: 'text.default.secondary' },
            { prop: 'toggleCheckedBorderColor', token: 'text.default.accent' },
            { prop: 'iconColor', token: 'text.on-dark.primary' },
            { prop: 'toggleBackgroundColor', value: 'transparent' },
            { prop: 'toggleCheckedBackgroundColor', token: 'text.default.accent' },
        ],
        negative: [
            { prop: 'iconColor', token: 'text.on-dark.primary' },
            { prop: 'toggleBackgroundColor', value: 'transparent' },
            { prop: 'toggleCheckedBackgroundColor', token: 'text.default.negative' },
            { prop: 'descriptionColor', token: 'text.default.secondary' },
            { prop: 'labelColor', token: 'text.default.primary' },
            { prop: 'toggleBorderColor', token: 'text.default.negative' },
            { prop: 'toggleCheckedBorderColor', token: 'text.default.negative' },
        ],
    },
    size: {
        s: [
            { prop: 'descriptionPadding', value: '2' },
            { prop: 'horizontalPadding', value: '8' },
            { prop: 'margin', value: '0' },
            { prop: 'toggleHeight', value: '14' },
            { prop: 'toggleShape', token: 'round.xxs' },
            { prop: 'verticalPadding', value: '0' },
            { prop: 'descriptionStyle', value: 'body.xs.normal' },
            { prop: 'labelStyle', value: 'body.s.normal' },
            { prop: 'toggleBorderWidth', value: '1' },
            { prop: 'togglePadding', value: '1' },
            { prop: 'toggleWidth', value: '14' },
        ],
        l: [
            { prop: 'descriptionPadding', value: '2' },
            { prop: 'horizontalPadding', value: '12' },
            { prop: 'margin', value: '0' },
            { prop: 'toggleHeight', value: '20' },
            { prop: 'toggleShape', token: 'round.xs' },
            { prop: 'verticalPadding', value: '1' },
            { prop: 'descriptionStyle', value: 'body.m.normal' },
            { prop: 'labelStyle', value: 'body.l.normal' },
            { prop: 'toggleBorderWidth', value: '2' },
            { prop: 'togglePadding', value: '2' },
            { prop: 'toggleWidth', value: '20' },
        ],
        m: [
            { prop: 'descriptionStyle', value: 'body.s.normal' },
            { prop: 'labelStyle', value: 'body.m.normal' },
            { prop: 'toggleBorderWidth', value: '2' },
            { prop: 'togglePadding', value: '2' },
            { prop: 'toggleWidth', value: '20' },
            { prop: 'descriptionPadding', value: '2' },
            { prop: 'horizontalPadding', value: '12' },
            { prop: 'margin', value: '0' },
            { prop: 'toggleHeight', value: '20' },
            { prop: 'toggleShape', token: 'round.xs' },
            { prop: 'verticalPadding', value: '1' },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'focusColor', token: 'text.default.accent' },
    { prop: 'disableAlpha', value: '0.4' },
];
