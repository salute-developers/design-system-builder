import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        default: [
            { prop: 'closeIconColor', token: 'text.default.secondary' },
            { prop: 'color', token: 'text.default.primary' },
            { prop: 'background', token: 'surface.default.solid-card-brightness' },
            { prop: 'closeIconColorOnHover', token: 'text.default.secondary' },
        ],
        positive: [
            { prop: 'closeIconColor', token: 'text.default.secondary' },
            { prop: 'color', token: 'text.default.primary' },
            { prop: 'background', token: 'surface.default.solid-card-brightness' },
            { prop: 'closeIconColorOnHover', token: 'text.default.secondary' },
            { prop: 'contentLeftColor', token: 'text.default.positive' },
        ],
        negative: [
            { prop: 'background', token: 'surface.default.solid-card-brightness' },
            { prop: 'closeIconColorOnHover', token: 'text.default.secondary' },
            { prop: 'contentLeftColor', token: 'text.default.negative' },
            { prop: 'closeIconColor', token: 'text.default.secondary' },
            { prop: 'color', token: 'text.default.primary' },
        ],
    },
    size: {
        m: [
            { prop: 'closeIconMargin', value: '-1', adjust: [{ platform: 'web', param: 'closeIconMargin', template: '$1 -0.25rem -0.0625rem 0.375rem' }] },
            { prop: 'contentLeftMargin', value: '-1', adjust: [{ platform: 'web', param: 'contentLeftMargin', template: '$1 0.375rem -0.0625rem -0.25rem' }] },
            { prop: 'maxWidth', value: 'calc(100vw - 5rem)' },
            { prop: 'borderRadius', token: 'round.m' },
            { prop: 'padding', value: '9', adjust: [{ platform: 'web', param: 'padding', template: '$1 0.75rem' }] },
            { prop: 'textStyle', value: 'body.xs.normal' },
        ],
    },
    closeIconType: {
        default: [
            { prop: 'closeIconButtonSize', value: '16' },
            { prop: 'closeIconSize', value: '24' },
        ],
    },
    shape: {
        pilled: [
            { prop: 'closeIconMargin', value: '-1', adjust: [{ platform: 'web', param: 'closeIconMargin', template: '$1 -0.25rem -0.0625rem 0.375rem' }] },
            { prop: 'contentLeftMargin', value: '-1', adjust: [{ platform: 'web', param: 'contentLeftMargin', template: '$1 0.375rem -0.0625rem -0.25rem' }] },
            { prop: 'pilledBorderRadius', value: '24' },
        ],
    },
};
