import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    size: {
        s: [
            { prop: 'descriptionStyle', value: 'body.xs.normal' },
            { prop: 'textStyle', value: 'body.s.normal' },
            { prop: 'labelOffset', value: '12' },
            { prop: 'verticalGap', value: '4' },
        ],
        m: [
            { prop: 'descriptionStyle', value: 'body.s.normal' },
            { prop: 'labelOffset', value: '12' },
            { prop: 'verticalGap', value: '4' },
            { prop: 'textStyle', value: 'body.m.normal' },
        ],
        l: [
            { prop: 'descriptionStyle', value: 'body.m.normal' },
            { prop: 'textStyle', value: 'body.l.normal' },
            { prop: 'labelOffset', value: '12' },
            { prop: 'verticalGap', value: '4' },
        ],
    },
    toggleSize: {
        l: [
            { prop: 'thumbOffsetOff', value: '2' },
            { prop: 'thumbPressScale', value: '1.25' },
            { prop: 'trackBorderRadius', token: 'round.l' },
            { prop: 'trackWidth', value: '44' },
            { prop: 'thumbBorderRadius', token: 'round.l' },
            { prop: 'thumbOffsetOn', value: '2' },
            { prop: 'thumbSize', value: '24' },
            { prop: 'trackHeight', value: '28' },
        ],
        s: [
            { prop: 'thumbOffsetOff', value: '2' },
            { prop: 'thumbPressScale', value: '1.25' },
            { prop: 'trackBorderRadius', token: 'round.m' },
            { prop: 'trackWidth', value: '32' },
            { prop: 'thumbBorderRadius', token: 'round.s' },
            { prop: 'thumbOffsetOn', value: '2' },
            { prop: 'thumbSize', value: '16' },
            { prop: 'trackHeight', value: '20' },
        ],
    },
    view: {
        default: [
            { prop: 'descriptionColor', value: '', state: 'hovered', adjust: [{ platform: 'web', param: 'descriptionColor', value: '' }] },
            { prop: 'descriptionMaxLines', value: 'initial' },
            { prop: 'labelColor', value: '', state: 'pressed', adjust: [{ platform: 'web', param: 'labelColor', value: '' }] },
            { prop: 'thumbBackgroundColorOff', token: 'surface.on-dark.solid-default' },
            { prop: 'thumbBackgroundColorOff', value: '', state: 'pressed', adjust: [{ platform: 'web', param: 'thumbBackgroundColorOff', value: '' }] },
            { prop: 'thumbBackgroundColorOn', value: '', state: 'pressed', adjust: [{ platform: 'web', param: 'thumbBackgroundColorOn', value: '' }] },
            { prop: 'thumbBoxShadow', token: 'down.soft.s' },
            { prop: 'trackBackgroundColorOff', token: 'surface.default.transparent-tertiary-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'trackBackgroundColorOff', value: 'surface.default.transparent-tertiary-hover' }] },
            { prop: 'trackBackgroundColorOn', token: 'surface.default.accent' },
            { prop: 'trackBackgroundColorOn', token: 'surface.default.accent-hover', state: 'hovered', adjust: [{ platform: 'web', param: 'trackBackgroundColorOn', value: 'surface.default.accent-hover' }] },
            { prop: 'trackBorderWidthOn', value: '0' },
            { prop: 'descriptionColor', token: 'text.default.secondary' },
            { prop: 'descriptionColor', value: '', state: 'pressed', adjust: [{ platform: 'web', param: 'descriptionColor', value: '' }] },
            { prop: 'labelColor', token: 'text.default.primary' },
            { prop: 'labelColor', value: '', state: 'hovered', adjust: [{ platform: 'web', param: 'labelColor', value: '' }] },
            { prop: 'thumbBackgroundColorOff', value: '', state: 'hovered', adjust: [{ platform: 'web', param: 'thumbBackgroundColorOff', value: '' }] },
            { prop: 'thumbBackgroundColorOn', token: 'surface.on-dark.solid-default' },
            { prop: 'thumbBackgroundColorOn', value: '', state: 'hovered', adjust: [{ platform: 'web', param: 'thumbBackgroundColorOn', value: '' }] },
            { prop: 'trackBackgroundColorOff', token: 'surface.default.transparent-tertiary' },
            { prop: 'trackBackgroundColorOff', value: '', state: 'pressed', adjust: [{ platform: 'web', param: 'trackBackgroundColorOff', value: '' }] },
            { prop: 'trackBackgroundColorOn', value: '', state: 'pressed', adjust: [{ platform: 'web', param: 'trackBackgroundColorOn', value: '' }] },
            { prop: 'trackBorderWidthOff', value: '0' },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'trackFocusColor', token: 'surface.default.accent' },
    { prop: 'disableAlpha', value: '1' },
];
