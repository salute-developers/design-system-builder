import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    size: {
        s: [
            { prop: 'size', value: '6' },
        ],
        L: [
            { prop: 'size', value: '12' },
        ],
        m: [
            { prop: 'size', value: '8' },
        ],
    },
    view: {
        accent: [
            { prop: 'color', token: 'surface.default.accent' },
        ],
        positive: [
            { prop: 'color', token: 'surface.default.positive' },
        ],
        negative: [
            { prop: 'color', token: 'surface.default.negative' },
        ],
        Default: [
            { prop: 'color', token: 'surface.default.solid-default' },
        ],
        inactive: [
            { prop: 'color', token: 'surface.default.solid-tertiary' },
        ],
        warning: [
            { prop: 'color', token: 'surface.default.warning' },
        ],
    },
};
