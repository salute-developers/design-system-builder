import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        default: [
            { prop: 'backgroundHover', token: 'surface.default.solid-card-hover' },
            { prop: 'borderColorActive', token: 'outline.default.accent' },
            { prop: 'descriptionColor', token: 'text.default.secondary' },
            { prop: 'titleColor', token: 'text.default.primary' },
            { prop: 'background', token: 'surface.default.solid-card' },
            { prop: 'borderColor', token: 'outline.default.solid-secondary' },
            { prop: 'borderColorHover', token: 'outline.default.solid-secondary-hover' },
            { prop: 'overlayColorActive', token: 'overlay.default.soft' },
        ],
    },
    size: {
        m: [
            { prop: 'contentColumnGap', value: '8' },
            { prop: 'contentWrapperGap', value: '12' },
            { prop: 'padding', value: '24' },
            { prop: 'borderRadius', token: 'round.xl' },
            { prop: 'contentGap', value: '6' },
            { prop: 'descriptionStyle', value: 'body.s.normal' },
            { prop: 'titleStyle', value: 'header.h4.bold' },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'disabledOpacity', value: '0.4' },
];
