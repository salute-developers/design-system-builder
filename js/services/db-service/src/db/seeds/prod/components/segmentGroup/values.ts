import type { ValueSeed, ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        clear: [
            { prop: 'arrowColor', token: 'text.default.secondary' },
            { prop: 'groupBackgroundColor', value: 'transparent' },
            { prop: 'groupFilledBackgroundColor', token: 'text.default.accent' },
        ],
        filled: [
            { prop: 'arrowColor', token: 'text.default.secondary' },
            { prop: 'groupBackgroundColor', value: 'transparent' },
            { prop: 'groupFilledBackgroundColor', token: 'text.default.accent' },
        ],
    },
    size: {
        xs: [
            { prop: 'groupWidth', value: 'auto' },
            { prop: 'groupHeight', value: 'auto' },
            { prop: 'groupBorderRadius', value: '10' },
            { prop: 'groupPilledBorderRadius', value: '18' },
            { prop: 'groupArrowPadding', value: '4', adjust: [{ platform: 'web', param: 'groupArrowPadding', template: '$1 0.75rem' }] },
            { prop: 'groupVerticalArrowPadding', value: '12', adjust: [{ platform: 'web', param: 'groupVerticalArrowPadding', template: '$1 0' }] },
        ],
        s: [
            { prop: 'groupWidth', value: 'auto' },
            { prop: 'groupHeight', value: 'auto' },
            { prop: 'groupBorderRadius', value: '12' },
            { prop: 'groupPilledBorderRadius', value: '22' },
            { prop: 'groupArrowPadding', value: '8', adjust: [{ platform: 'web', param: 'groupArrowPadding', template: '$1 0.75rem' }] },
            { prop: 'groupVerticalArrowPadding', value: '14', adjust: [{ platform: 'web', param: 'groupVerticalArrowPadding', template: '$1 0' }] },
        ],
        m: [
            { prop: 'groupWidth', value: 'auto' },
            { prop: 'groupHeight', value: 'auto' },
            { prop: 'groupBorderRadius', value: '14' },
            { prop: 'groupPilledBorderRadius', value: '26' },
            { prop: 'groupArrowPadding', value: '12', adjust: [{ platform: 'web', param: 'groupArrowPadding', template: '$1 0.75rem' }] },
            { prop: 'groupVerticalArrowPadding', value: '20', adjust: [{ platform: 'web', param: 'groupVerticalArrowPadding', template: '$1 0' }] },
        ],
        l: [
            { prop: 'groupWidth', value: 'auto' },
            { prop: 'groupHeight', value: 'auto' },
            { prop: 'groupBorderRadius', value: '16' },
            { prop: 'groupPilledBorderRadius', value: '30' },
            { prop: 'groupArrowPadding', value: '16', adjust: [{ platform: 'web', param: 'groupArrowPadding', template: '$1 0.75rem' }] },
            { prop: 'groupVerticalArrowPadding', value: '22', adjust: [{ platform: 'web', param: 'groupVerticalArrowPadding', template: '$1 0' }] },
        ],
        xl: [
            { prop: 'groupWidth', value: 'auto' },
            { prop: 'groupHeight', value: 'auto' },
            { prop: 'groupBorderRadius', value: '18' },
            { prop: 'groupPilledBorderRadius', value: '1000' },
            { prop: 'groupArrowPadding', value: '20', adjust: [{ platform: 'web', param: 'groupArrowPadding', template: '$1 0.75rem' }] },
            { prop: 'groupVerticalArrowPadding', value: '24', adjust: [{ platform: 'web', param: 'groupVerticalArrowPadding', template: '$1 0' }] },
        ],
    },
    filledBackground: {
        true: [
            { prop: 'groupFilledBackgroundColor', token: 'surface.default.transparent-secondary' },
        ],
    },
};

export const invariants: ValueSeed[] = [
    { prop: 'disabledOpacity', value: '0.4' },
];
