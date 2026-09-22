import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        inverse: [
            { prop: 'background', token: 'text.inverse.tertiary' },
        ],
        dark: [
            { prop: 'background', token: 'surface.on-dark.transparent-tertiary' },
        ],
        light: [
            { prop: 'background', token: 'surface.on-light.transparent-tertiary' },
        ],
        default: [
            { prop: 'background', token: 'surface.default.transparent-tertiary' },
        ],
    },
    orientation: {
        horizontal: [
            { prop: 'baseSideSize', value: '1' },
        ],
        vertical: [
            { prop: 'baseSideSize', value: '1' },
        ],
    },
    size: {
        m: [
            { prop: 'borderRadius', token: 'round.xxs' },
        ],
    },
};
