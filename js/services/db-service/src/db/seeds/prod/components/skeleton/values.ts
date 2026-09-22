import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    size: {
        textXS: [
            { prop: 'visibleLineHeight', value: '12' },
            { prop: 'lineHeight', value: 'text.xs.normal' },
        ],
        h4: [
            { prop: 'visibleLineHeight', value: '18' },
            { prop: 'lineHeight', value: 'header.h4.normal' },
        ],
        textL: [
            { prop: 'visibleLineHeight', value: '18' },
            { prop: 'lineHeight', value: 'text.l.normal' },
        ],
        h1: [
            { prop: 'visibleLineHeight', value: '28' },
            { prop: 'lineHeight', value: 'header.h1.normal' },
        ],
        bodyS: [
            { prop: 'visibleLineHeight', value: '14' },
            { prop: 'lineHeight', value: 'body.s.normal' },
        ],
        dsplL: [
            { prop: 'lineHeight', value: 'display.l.normal' },
            { prop: 'visibleLineHeight', value: '88' },
        ],
        dsplS: [
            { prop: 'visibleLineHeight', value: '40' },
            { prop: 'lineHeight', value: 'display.s.normal' },
        ],
        bodyM: [
            { prop: 'visibleLineHeight', value: '16' },
            { prop: 'lineHeight', value: 'body.m.normal' },
        ],
        bodyXXS: [
            { prop: 'visibleLineHeight', value: '10' },
            { prop: 'lineHeight', value: 'body.xxs.normal' },
        ],
        textM: [
            { prop: 'visibleLineHeight', value: '16' },
            { prop: 'lineHeight', value: 'text.m.normal' },
        ],
        h2: [
            { prop: 'lineHeight', value: 'header.h2.normal' },
            { prop: 'visibleLineHeight', value: '24' },
        ],
        h5: [
            { prop: 'lineHeight', value: 'header.h5.normal' },
            { prop: 'visibleLineHeight', value: '16' },
        ],
        textS: [
            { prop: 'lineHeight', value: 'text.s.normal' },
            { prop: 'visibleLineHeight', value: '14' },
        ],
        dsplM: [
            { prop: 'lineHeight', value: 'display.m.normal' },
            { prop: 'visibleLineHeight', value: '56' },
        ],
        h3: [
            { prop: 'lineHeight', value: 'header.h3.normal' },
            { prop: 'visibleLineHeight', value: '20' },
        ],
        bodyL: [
            { prop: 'lineHeight', value: 'body.l.normal' },
            { prop: 'visibleLineHeight', value: '18' },
        ],
        h6: [
            { prop: 'lineHeight', value: 'header.h6.normal' },
            { prop: 'visibleLineHeight', value: '10' },
        ],
        bodyXS: [
            { prop: 'lineHeight', value: 'body.xs.normal' },
            { prop: 'visibleLineHeight', value: '12' },
        ],
    },
    view: {
        default: [
            { prop: 'fadeInColor', value: '', state: 'pressed', adjust: [{ platform: 'web', param: 'fadeInColor', value: '' }] },
            { prop: 'fadeOutColor', token: 'surface.default.transparent-tertiary' },
            { prop: 'fadeOutColor', value: '', state: 'hovered', adjust: [{ platform: 'web', param: 'fadeOutColor', value: '' }] },
            { prop: 'fadeInColor', token: 'surface.default.transparent-secondary' },
            { prop: 'fadeInColor', value: '', state: 'hovered', adjust: [{ platform: 'web', param: 'fadeInColor', value: '' }] },
            { prop: 'fadeOutColor', value: '', state: 'pressed', adjust: [{ platform: 'web', param: 'fadeOutColor', value: '' }] },
        ],
    },
};
