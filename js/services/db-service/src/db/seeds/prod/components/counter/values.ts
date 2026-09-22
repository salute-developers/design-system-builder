import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    size: {
        l: [
            { prop: 'labelStyle', value: 'body.s.normal' },
            { prop: 'padding', value: '10' },
            { prop: 'shape', token: 'round.l' },
            { prop: 'height', value: '28' },
        ],
        m: [
            { prop: 'labelStyle', value: 'body.xs.normal' },
            { prop: 'padding', value: '8' },
            { prop: 'height', value: '24' },
            { prop: 'shape', token: 'round.l' },
        ],
        s: [
            { prop: 'shape', token: 'round.l' },
            { prop: 'height', value: '20' },
            { prop: 'padding', value: '6' },
            { prop: 'labelStyle', value: 'body.xxs.normal' },
        ],
        xs: [
            { prop: 'labelStyle', value: 'body.xxs.normal' },
            { prop: 'padding', value: '4' },
            { prop: 'height', value: '16' },
            { prop: 'shape', token: 'round.l' },
        ],
        xxs: [
            { prop: 'labelStyle', value: 'body.xxs.normal' },
            { prop: 'height', value: '12' },
            { prop: 'shape', token: 'round.l' },
            { prop: 'padding', value: '2' },
        ],
    },
    view: {
        accent: [
            { prop: 'color', token: 'text.on-dark.primary' },
            { prop: 'background', token: 'surface.default.accent' },
        ],
        positive: [
            { prop: 'color', token: 'text.on-dark.primary' },
            { prop: 'background', token: 'surface.default.positive' },
        ],
        default: [
            { prop: 'background', token: 'surface.default.solid-default' },
            { prop: 'color', token: 'text.inverse.primary' },
        ],
        warning: [
            { prop: 'background', token: 'surface.default.warning' },
            { prop: 'color', token: 'text.on-dark.primary' },
        ],
        negative: [
            { prop: 'color', token: 'text.on-dark.primary' },
            { prop: 'background', token: 'surface.default.negative' },
        ],
    },
};
