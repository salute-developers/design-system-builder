import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        default: [
            { prop: 'iconColor', token: 'text.inverse.primary' },
            { prop: 'iconColor', token: 'text.inverse.primary-active', state: 'pressed' },
            { prop: 'iconColor', token: 'text.inverse.primary-hover', state: 'hovered' },
            { prop: 'loadingBackgroundColor', token: 'text.inverse.primary' },
            { prop: 'spinnerColor', token: 'text.inverse.primary' },
            { prop: 'backgroundColor', token: 'surface.default.solid-default' },
            { prop: 'backgroundColor', token: 'surface.default.solid-default-active', state: 'pressed' },
            { prop: 'backgroundColor', token: 'surface.default.solid-default-hover', state: 'hovered' },
        ],
        secondary: [
            { prop: 'iconColor', token: 'text.default.primary' },
            { prop: 'iconColor', token: 'text.default.primary-active', state: 'pressed' },
            { prop: 'iconColor', token: 'text.default.primary-hover', state: 'hovered' },
            { prop: 'loadingBackgroundColor', token: 'text.default.primary' },
            { prop: 'spinnerColor', token: 'text.default.primary' },
            { prop: 'backgroundColor', token: 'surface.default.transparent-secondary' },
            { prop: 'backgroundColor', token: 'surface.default.transparent-secondary-active', state: 'pressed' },
            { prop: 'backgroundColor', token: 'surface.default.transparent-secondary-hover', state: 'hovered' },
        ],
        accent: [
            { prop: 'iconColor', token: 'text.on-dark.primary' },
            { prop: 'iconColor', token: 'text.on-dark.primary-active', state: 'pressed' },
            { prop: 'iconColor', token: 'text.on-dark.primary-hover', state: 'hovered' },
            { prop: 'loadingBackgroundColor', token: 'text.on-dark.primary' },
            { prop: 'spinnerColor', token: 'text.on-dark.primary' },
            { prop: 'backgroundColor', token: 'surface.default.accent' },
            { prop: 'backgroundColor', token: 'surface.default.accent-active', state: 'pressed' },
            { prop: 'backgroundColor', token: 'surface.default.accent-hover', state: 'hovered' },
        ],
    },
    size: {
        xl: [
            { prop: 'height', value: '64' },
            { prop: 'paddingStart', value: '20' },
            { prop: 'paddingEnd', value: '20' },
            { prop: 'minWidth', value: '64' },
            { prop: 'iconSize', value: '24' },
            { prop: 'spinnerSize', value: '24' },
            { prop: 'spinnerStrokeWidth', value: '2' },
            { prop: 'shape', token: 'round.l' },
        ],
        l: [
            { prop: 'height', value: '56' },
            { prop: 'paddingStart', value: '16' },
            { prop: 'paddingEnd', value: '16' },
            { prop: 'minWidth', value: '56' },
            { prop: 'iconSize', value: '24' },
            { prop: 'spinnerSize', value: '22' },
            { prop: 'spinnerStrokeWidth', value: '2' },
            { prop: 'shape', token: 'round.l', adjust: [{ platform: 'xml', param: 'sd_shapeAppearance', value: '-2' }, { platform: 'compose', param: 'shape', value: '-2' }, { platform: 'ios', param: 'cornerRadius', value: '-2' }, { platform: 'web', param: 'iconButtonRadius', value: '-2' }] },
        ],
        m: [
            { prop: 'height', value: '48' },
            { prop: 'paddingStart', value: '12' },
            { prop: 'paddingEnd', value: '12' },
            { prop: 'minWidth', value: '48' },
            { prop: 'iconSize', value: '24' },
            { prop: 'spinnerSize', value: '22' },
            { prop: 'spinnerStrokeWidth', value: '2' },
            { prop: 'shape', token: 'round.m' },
        ],
        s: [
            { prop: 'height', value: '40' },
            { prop: 'paddingStart', value: '16' },
            { prop: 'paddingEnd', value: '16' },
            { prop: 'minWidth', value: '40' },
            { prop: 'iconSize', value: '24' },
            { prop: 'spinnerSize', value: '22' },
            { prop: 'spinnerStrokeWidth', value: '2' },
        ],
        xs: [
            { prop: 'height', value: '32' },
            { prop: 'paddingStart', value: '12' },
            { prop: 'paddingEnd', value: '12' },
            { prop: 'minWidth', value: '32' },
            { prop: 'iconSize', value: '16' },
            { prop: 'spinnerSize', value: '16' },
            { prop: 'spinnerStrokeWidth', value: '2' },
            { prop: 'shape', token: 'round.s' },
        ],
    },
    shape: {
        pilled: [
            { prop: 'shape', token: 'round.circle' },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'loadingAlpha', value: '0' },
    { prop: 'disableAlpha', value: '0.4' },
    { prop: 'focusColor', token: 'text.default.accent' },
];
