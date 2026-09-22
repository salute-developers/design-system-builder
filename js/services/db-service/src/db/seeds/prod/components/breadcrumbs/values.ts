import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        default: [
            { prop: 'breadcrumbsColorSeparator', token: 'text.default.primary' },
            { prop: 'breadcrumbsFocusOutlineColor', token: 'surface.default.accent' },
            { prop: 'breadcrumbsColor', token: 'text.default.primary' },
            { prop: 'breadcrumbsColorText', token: 'text.default.primary' },
            { prop: 'breadcrumbsOpacity', value: '0.4' },
        ],
    },
    size: {
        l: [
            { prop: 'breadcrumbsGap', value: '8' },
            { prop: 'breadcrumbsStyle', value: 'body.l.bold' },
        ],
        m: [
            { prop: 'breadcrumbsGap', value: '6' },
            { prop: 'breadcrumbsStyle', value: 'body.m.bold' },
        ],
        s: [
            { prop: 'breadcrumbsGap', value: '4' },
            { prop: 'breadcrumbsStyle', value: 'body.s.bold' },
        ],
        xs: [
            { prop: 'breadcrumbsGap', value: '0' },
            { prop: 'breadcrumbsStyle', value: 'body.xs.bold' },
        ],
    },
};
