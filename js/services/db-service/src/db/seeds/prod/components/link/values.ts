import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        secondary: [
            { prop: 'textColor', token: 'text.default.secondary' },
            { prop: 'textColor', token: 'text.default.secondary-active', state: 'pressed', adjust: [{ platform: 'xml', param: 'contentColor', value: 'text.default.secondary-active' }, { platform: 'compose', param: 'contentColor', value: 'text.default.secondary-active' }, { platform: 'ios', param: 'contentColor', value: 'text.default.secondary-active' }, { platform: 'web', param: 'linkColor', value: 'text.default.secondary-active' }] },
            { prop: 'textColorVisited', token: 'text.default.tertiary-hover', state: 'hovered', adjust: [{ platform: 'xml', param: 'contentColorVisited', value: 'text.default.tertiary-hover' }, { platform: 'compose', param: 'contentColorVisited', value: 'text.default.tertiary-hover' }, { platform: 'ios', param: 'contentColorVisited', value: 'text.default.tertiary-hover' }, { platform: 'web', param: 'linkColorVisited', value: 'text.default.tertiary-hover' }] },
            { prop: 'underlineBorderWidth', value: '0' },
            { prop: 'textColor', token: 'text.default.secondary-hover', state: 'hovered', adjust: [{ platform: 'xml', param: 'contentColor', value: 'text.default.secondary-hover' }, { platform: 'compose', param: 'contentColor', value: 'text.default.secondary-hover' }, { platform: 'ios', param: 'contentColor', value: 'text.default.secondary-hover' }, { platform: 'web', param: 'linkColor', value: 'text.default.secondary-hover' }] },
            { prop: 'textColorVisited', token: 'text.default.tertiary' },
            { prop: 'textColorVisited', token: 'text.default.tertiary-active', state: 'pressed', adjust: [{ platform: 'xml', param: 'contentColorVisited', value: 'text.default.tertiary-active' }, { platform: 'compose', param: 'contentColorVisited', value: 'text.default.tertiary-active' }, { platform: 'ios', param: 'contentColorVisited', value: 'text.default.tertiary-active' }, { platform: 'web', param: 'linkColorVisited', value: 'text.default.tertiary-active' }] },
        ],
        clear: [
            { prop: 'textColor', value: 'inherit' },
            { prop: 'underlineBorderWidth', value: '1' },
            { prop: 'textColorVisited', value: 'inherit' },
        ],
        default: [
            { prop: 'textColor', token: 'text.default.primary-hover', state: 'hovered', adjust: [{ platform: 'xml', param: 'contentColor', value: 'text.default.primary-hover' }, { platform: 'compose', param: 'contentColor', value: 'text.default.primary-hover' }, { platform: 'ios', param: 'contentColor', value: 'text.default.primary-hover' }, { platform: 'web', param: 'linkColor', value: 'text.default.primary-hover' }] },
            { prop: 'textColorVisited', token: 'text.default.secondary' },
            { prop: 'textColorVisited', token: 'text.default.secondary-active', state: 'pressed', adjust: [{ platform: 'xml', param: 'contentColorVisited', value: 'text.default.secondary-active' }, { platform: 'compose', param: 'contentColorVisited', value: 'text.default.secondary-active' }, { platform: 'ios', param: 'contentColorVisited', value: 'text.default.secondary-active' }, { platform: 'web', param: 'linkColorVisited', value: 'text.default.secondary-active' }] },
            { prop: 'textColor', token: 'text.default.primary' },
            { prop: 'textColor', token: 'text.default.primary-active', state: 'pressed', adjust: [{ platform: 'xml', param: 'contentColor', value: 'text.default.primary-active' }, { platform: 'compose', param: 'contentColor', value: 'text.default.primary-active' }, { platform: 'ios', param: 'contentColor', value: 'text.default.primary-active' }, { platform: 'web', param: 'linkColor', value: 'text.default.primary-active' }] },
            { prop: 'textColorVisited', token: 'text.default.secondary-hover', state: 'hovered', adjust: [{ platform: 'xml', param: 'contentColorVisited', value: 'text.default.secondary-hover' }, { platform: 'compose', param: 'contentColorVisited', value: 'text.default.secondary-hover' }, { platform: 'ios', param: 'contentColorVisited', value: 'text.default.secondary-hover' }, { platform: 'web', param: 'linkColorVisited', value: 'text.default.secondary-hover' }] },
            { prop: 'underlineBorderWidth', value: '0' },
        ],
        accent: [
            { prop: 'textColor', token: 'text.default.accent-hover', state: 'hovered', adjust: [{ platform: 'xml', param: 'contentColor', value: 'text.default.accent-hover' }, { platform: 'compose', param: 'contentColor', value: 'text.default.accent-hover' }, { platform: 'ios', param: 'contentColor', value: 'text.default.accent-hover' }, { platform: 'web', param: 'linkColor', value: 'text.default.accent-hover' }] },
            { prop: 'textColorVisited', token: 'text.default.accent-minor' },
            { prop: 'textColorVisited', token: 'text.default.accent-minor-active', state: 'pressed', adjust: [{ platform: 'xml', param: 'contentColorVisited', value: 'text.default.accent-minor-active' }, { platform: 'compose', param: 'contentColorVisited', value: 'text.default.accent-minor-active' }, { platform: 'ios', param: 'contentColorVisited', value: 'text.default.accent-minor-active' }, { platform: 'web', param: 'linkColorVisited', value: 'text.default.accent-minor-active' }] },
            { prop: 'textColor', token: 'text.default.accent' },
            { prop: 'textColor', token: 'text.default.accent-active', state: 'pressed', adjust: [{ platform: 'xml', param: 'contentColor', value: 'text.default.accent-active' }, { platform: 'compose', param: 'contentColor', value: 'text.default.accent-active' }, { platform: 'ios', param: 'contentColor', value: 'text.default.accent-active' }, { platform: 'web', param: 'linkColor', value: 'text.default.accent-active' }] },
            { prop: 'textColorVisited', token: 'text.default.accent-minor-hover', state: 'hovered', adjust: [{ platform: 'xml', param: 'contentColorVisited', value: 'text.default.accent-minor-hover' }, { platform: 'compose', param: 'contentColorVisited', value: 'text.default.accent-minor-hover' }, { platform: 'ios', param: 'contentColorVisited', value: 'text.default.accent-minor-hover' }, { platform: 'web', param: 'linkColorVisited', value: 'text.default.accent-minor-hover' }] },
            { prop: 'underlineBorderWidth', value: '0' },
        ],
    },
    size: {
        m: [
            { prop: 'textStyle', value: 'body.m.normal' },
        ],
        s: [
            { prop: 'textStyle', value: 'body.s.normal' },
        ],
        l: [
            { prop: 'textStyle', value: 'body.l.normal' },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'disableAlpha', value: '0.4' },
    { prop: 'focusColor', token: 'text.default.accent' },
];
