import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        default: [
            { prop: 'solidBackground', token: 'surface.default.solid-card' },
        ],
    },
    size: {
        l: [
            { prop: 'borderWidth', value: '1' },
            { prop: 'outlineWidth', value: '12' },
            { prop: 'borderRadius', value: '16' },
            { prop: 'contentBorderRadius', token: 'round.s' },
        ],
        m: [
            { prop: 'borderWidth', value: '1' },
            { prop: 'outlineWidth', value: '10' },
            { prop: 'borderRadius', value: '14' },
            { prop: 'contentBorderRadius', token: 'round.xs' },
        ],
        s: [
            { prop: 'borderWidth', value: '1' },
            { prop: 'outlineWidth', value: '8' },
            { prop: 'borderRadius', value: '12' },
            { prop: 'contentBorderRadius', token: 'round.xs' },
        ],
    },
};
