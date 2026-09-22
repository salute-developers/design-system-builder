import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        default: [
            { prop: 'completedIndicatorBackgroundHover', token: 'surface.default.solid-default-hover' },
            { prop: 'completedIndicatorColorHover', token: 'text.inverse.primary' },
            { prop: 'completedTitleColorHover', token: 'text.default.primary-hover' },
            { prop: 'completedIndicatorBackground', token: 'surface.default.solid-default' },
            { prop: 'completedIndicatorColor', token: 'text.inverse.primary' },
            { prop: 'completedTitleColor', token: 'text.default.primary' },
            { prop: 'dividerColor', token: 'surface.default.solid-default' },
        ],
        accent: [
            { prop: 'completedIndicatorBackground', token: 'surface.default.accent' },
            { prop: 'completedIndicatorColor', token: 'text.on-dark.primary' },
            { prop: 'completedTitleColor', token: 'text.default.primary' },
            { prop: 'dividerColor', token: 'surface.default.accent' },
            { prop: 'completedIndicatorBackgroundHover', token: 'surface.default.accent-hover' },
            { prop: 'completedIndicatorColorHover', token: 'text.on-dark.primary-hover' },
            { prop: 'completedTitleColorHover', token: 'text.default.primary-hover' },
        ],
        negative: [
            { prop: 'completedIndicatorBackgroundHover', token: 'surface.default.negative-hover' },
            { prop: 'completedIndicatorColorHover', token: 'text.on-dark.primary-hover' },
            { prop: 'completedTitleColorHover', token: 'text.default.negative-hover' },
            { prop: 'completedIndicatorBackground', token: 'surface.default.negative' },
            { prop: 'completedIndicatorColor', token: 'text.on-dark.primary' },
            { prop: 'completedTitleColor', token: 'text.default.negative' },
            { prop: 'dividerColor', token: 'surface.default.negative' },
        ],
        warning: [
            { prop: 'completedIndicatorBackground', token: 'surface.default.warning' },
            { prop: 'completedIndicatorColor', token: 'text.on-dark.primary' },
            { prop: 'completedTitleColor', token: 'text.default.warning' },
            { prop: 'dividerColor', token: 'surface.default.warning' },
            { prop: 'completedIndicatorBackgroundHover', token: 'surface.default.warning-hover' },
            { prop: 'completedIndicatorColorHover', token: 'text.on-dark.primary-hover' },
            { prop: 'completedTitleColorHover', token: 'text.default.warning-hover' },
        ],
        positive: [
            { prop: 'completedIndicatorBackgroundHover', token: 'surface.default.positive-hover' },
            { prop: 'completedIndicatorColorHover', token: 'text.on-dark.primary-hover' },
            { prop: 'completedTitleColorHover', token: 'text.default.positive-hover' },
            { prop: 'completedIndicatorBackground', token: 'surface.default.positive' },
            { prop: 'completedIndicatorColor', token: 'text.on-dark.primary' },
            { prop: 'completedTitleColor', token: 'text.default.positive' },
            { prop: 'dividerColor', token: 'surface.default.positive' },
        ],
    },
};
