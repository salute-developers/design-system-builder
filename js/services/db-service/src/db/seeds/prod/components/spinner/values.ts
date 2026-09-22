import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    size: {
        M: [
            { prop: 'size', value: '24' },
        ],
        l: [
            { prop: 'size', value: '36' },
        ],
        S: [
            { prop: 'size', value: '16' },
        ],
    },
    view: {
        paragraph: [
            { prop: 'color', token: 'text.default.paragraph' },
        ],
        positive: [
            { prop: 'color', token: 'text.default.positive' },
        ],
        negative: [
            { prop: 'color', token: 'text.default.negative' },
        ],
        secondary: [
            { prop: 'color', token: 'text.default.secondary' },
        ],
        accent: [
            { prop: 'color', token: 'text.default.accent' },
        ],
        warning: [
            { prop: 'color', token: 'text.default.warning' },
        ],
        default: [
            { prop: 'color', token: 'text.default.primary' },
        ],
        tertiary: [
            { prop: 'color', token: 'text.default.tertiary' },
        ],
    },
};
