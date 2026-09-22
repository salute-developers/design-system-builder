import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        default: [
            { prop: 'handleBackgroundColor', token: 'surface.default.solid-tertiary' },
            { prop: 'sheetOverlayWithBlurColor', token: 'overlay.default.blur' },
            { prop: 'contentBackgroundColor', token: 'surface.default.solid-card' },
            { prop: 'sheetOverlayColor', token: 'overlay.default.soft' },
        ],
    },
    handlePlacement: {
        inner: [
            { prop: 'handleMarginTop', value: '-38' },
        ],
        outer: [
            { prop: 'handleMarginTop', value: '-22' },
        ],
    },
};
