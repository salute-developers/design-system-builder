import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        secondary: [
            { prop: 'embedIconButtonColor', token: 'text.default.secondary' },
            { prop: 'embedIconButtonColor', token: 'text.default.secondary-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.secondary-hover' }] },
            { prop: 'embedIconButtonColor', token: 'text.default.secondary-active', state: 'pressed', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.secondary-active' }] },
        ],
        positive: [
            { prop: 'embedIconButtonColor', token: 'text.default.positive-active', state: 'pressed', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.positive-active' }] },
            { prop: 'embedIconButtonColor', token: 'text.default.positive' },
            { prop: 'embedIconButtonColor', token: 'text.default.positive-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.positive-hover' }] },
        ],
        warning: [
            { prop: 'embedIconButtonColor', token: 'text.default.warning' },
            { prop: 'embedIconButtonColor', token: 'text.default.warning-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.warning-hover' }] },
            { prop: 'embedIconButtonColor', token: 'text.default.warning-active', state: 'pressed', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.warning-active' }] },
        ],
        negative: [
            { prop: 'embedIconButtonColor', token: 'text.default.negative-active', state: 'pressed', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.negative-active' }] },
            { prop: 'embedIconButtonColor', token: 'text.default.negative' },
            { prop: 'embedIconButtonColor', token: 'text.default.negative-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.negative-hover' }] },
        ],
        info: [
            { prop: 'embedIconButtonColor', token: 'text.default.info' },
            { prop: 'embedIconButtonColor', token: 'text.default.info-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.info-hover' }] },
            { prop: 'embedIconButtonColor', token: 'text.default.info-active', state: 'pressed', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.info-active' }] },
        ],
        default: [
            { prop: 'embedIconButtonColor', token: 'text.default.primary-active', state: 'pressed', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.primary-active' }] },
            { prop: 'embedIconButtonColor', token: 'text.default.primary' },
            { prop: 'embedIconButtonColor', token: 'text.default.primary-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.primary-hover' }] },
        ],
        accent: [
            { prop: 'embedIconButtonColor', token: 'text.default.accent' },
            { prop: 'embedIconButtonColor', token: 'text.default.accent-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.accent-hover' }] },
            { prop: 'embedIconButtonColor', token: 'text.default.accent-active', state: 'pressed', adjust: [{ platform: 'web', param: 'embedIconButtonColor', value: 'text.default.accent-active' }] },
        ],
    },
    size: {
        l: [
            { prop: 'embedIconButtonPadding', value: '0' },
            { prop: 'embedIconButtonSpinnerSize', value: '28' },
            { prop: 'textStyle', value: 'body.l.bold' },
            { prop: 'embedIconButtonHeight', value: '36' },
            { prop: 'embedIconButtonRadius', token: 'round.m' },
            { prop: 'embedIconButtonWidth', value: '36' },
        ],
        m: [
            { prop: 'embedIconButtonPadding', value: '0' },
            { prop: 'embedIconButtonSpinnerSize', value: '20' },
            { prop: 'textStyle', value: 'body.m.bold' },
            { prop: 'embedIconButtonHeight', value: '24' },
            { prop: 'embedIconButtonRadius', token: 'round.s' },
            { prop: 'embedIconButtonWidth', value: '24' },
        ],
        s: [
            { prop: 'embedIconButtonPadding', value: '0' },
            { prop: 'embedIconButtonSpinnerSize', value: '12' },
            { prop: 'textStyle', value: 'body.s.bold' },
            { prop: 'embedIconButtonHeight', value: '16' },
            { prop: 'embedIconButtonRadius', token: 'round.s' },
            { prop: 'embedIconButtonWidth', value: '16' },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'embedIconButtonFocusColor', token: 'surface.default.accent' },
    { prop: 'embedIconButtonDisabledAlpha', value: '0.4' },
];
