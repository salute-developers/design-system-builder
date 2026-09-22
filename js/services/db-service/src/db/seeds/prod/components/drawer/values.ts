import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        default: [
            { prop: 'background', token: 'surface.default.solid-card' },
            { prop: 'drawerOverlayColor', token: 'overlay.default.soft' },
            { prop: 'shadow', value: '0 3.75rem 7rem -0.5rem rgba(0, 0, 0, 0.08)' },
            { prop: 'contentBackgroundColor', token: 'surface.default.transparent-primary' },
            { prop: 'drawerOverlayWithBlurColor', token: 'overlay.default.blur' },
        ],
    },
    size: {
        m: [
            { prop: 'padding', value: '24' },
        ],
    },
    borderRadius: {
        none: [
            { prop: 'borderRadius', value: '0' },
        ],
        default: [
            { prop: 'borderRadius', value: '20' },
        ],
    },
};
