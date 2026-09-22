import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        default: [
            { prop: 'background', token: 'surface.default.solid-card-brightness' },
            { prop: 'dividerColor', token: 'surface.default.transparent-tertiary' },
            { prop: 'boxShadow', value: '0px 4px 14px -4px rgba(8, 8, 8, 0.08), 0px 1px 4px -1px rgba(0, 0, 0, 0.04)' },
        ],
    },
    size: {
        xs: [
            { prop: 'dividerBorderRadius', value: '1' },
            { prop: 'dividerSize', value: '20' },
            { prop: 'size', value: '40' },
            { prop: 'borderRadius', value: '12' },
            { prop: 'dividerOffset', value: '8' },
            { prop: 'padding', value: '4' },
        ],
        s: [
            { prop: 'dividerBorderRadius', value: '1' },
            { prop: 'dividerSize', value: '24' },
            { prop: 'size', value: '48' },
            { prop: 'borderRadius', value: '14' },
            { prop: 'dividerOffset', value: '8' },
            { prop: 'padding', value: '4' },
        ],
        m: [
            { prop: 'dividerBorderRadius', value: '1' },
            { prop: 'dividerSize', value: '28' },
            { prop: 'size', value: '60' },
            { prop: 'borderRadius', value: '16' },
            { prop: 'dividerOffset', value: '10' },
            { prop: 'padding', value: '6' },
        ],
        l: [
            { prop: 'dividerBorderRadius', value: '1' },
            { prop: 'dividerSize', value: '32' },
            { prop: 'size', value: '72' },
            { prop: 'borderRadius', value: '20' },
            { prop: 'dividerOffset', value: '12' },
            { prop: 'padding', value: '8' },
        ],
    },
};
