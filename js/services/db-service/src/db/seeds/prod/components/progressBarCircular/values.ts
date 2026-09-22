import type { ValuesSeed } from '../../component-seed';

export const values: ValuesSeed = {
    view: {
        accent: [
            { prop: 'contentColor', token: 'text.default.primary' },
            { prop: 'backgroundStroke', token: 'surface.default.transparent-tertiary' },
            { prop: 'progressStroke', token: 'surface.default.accent' },
        ],
        positive: [
            { prop: 'backgroundStroke', token: 'surface.default.transparent-tertiary' },
            { prop: 'progressStroke', token: 'surface.default.positive' },
            { prop: 'contentColor', token: 'text.default.primary' },
        ],
        warning: [
            { prop: 'contentColor', token: 'text.default.primary' },
            { prop: 'backgroundStroke', token: 'surface.default.transparent-tertiary' },
            { prop: 'progressStroke', token: 'surface.default.warning' },
        ],
        negative: [
            { prop: 'backgroundStroke', token: 'surface.default.transparent-tertiary' },
            { prop: 'progressStroke', token: 'surface.default.negative' },
            { prop: 'contentColor', token: 'text.default.primary' },
        ],
        info: [
            { prop: 'contentColor', token: 'text.default.primary' },
            { prop: 'backgroundStroke', token: 'surface.default.transparent-tertiary' },
            { prop: 'progressStroke', token: 'surface.default.info' },
        ],
        default: [
            { prop: 'contentColor', token: 'text.default.primary' },
            { prop: 'backgroundStroke', token: 'surface.default.transparent-tertiary' },
            { prop: 'progressStroke', token: 'surface.default.solid-default' },
        ],
        secondary: [
            { prop: 'backgroundStroke', token: 'surface.default.transparent-tertiary' },
            { prop: 'progressStroke', token: 'surface.default.transparent-secondary' },
            { prop: 'contentColor', token: 'text.default.primary' },
        ],
    },
    size: {
        xxl: [
            { prop: 'contentStyle', value: 'header.h2.bold' },
            { prop: 'size', value: '128' },
            { prop: 'strokeWidth', value: '4' },
            { prop: 'height', value: '128' },
            { prop: 'strokeSize', value: '4' },
            { prop: 'width', value: '128' },
        ],
        xl: [
            { prop: 'contentStyle', value: 'header.h5.bold' },
            { prop: 'size', value: '88' },
            { prop: 'strokeWidth', value: '4' },
            { prop: 'height', value: '88' },
            { prop: 'strokeSize', value: '4' },
            { prop: 'width', value: '88' },
        ],
        l: [
            { prop: 'contentStyle', value: 'body.l.normal' },
            { prop: 'height', value: '56' },
            { prop: 'strokeSize', value: '2' },
            { prop: 'width', value: '56' },
            { prop: 'size', value: '56' },
            { prop: 'strokeWidth', value: '2' },
        ],
        m: [
            { prop: 'height', value: '48' },
            { prop: 'strokeSize', value: '2' },
            { prop: 'width', value: '48' },
            { prop: 'contentStyle', value: 'body.m.normal' },
            { prop: 'size', value: '48' },
            { prop: 'strokeWidth', value: '2' },
        ],
        s: [
            { prop: 'height', value: '36' },
            { prop: 'strokeSize', value: '2' },
            { prop: 'contentStyle', value: 'body.s.normal' },
            { prop: 'size', value: '32' },
            { prop: 'strokeWidth', value: '2' },
            { prop: 'width', value: '36' },
        ],
        xs: [
            { prop: 'contentStyle', value: 'body.xs.normal' },
            { prop: 'size', value: '24' },
            { prop: 'strokeWidth', value: '2' },
            { prop: 'height', value: '24' },
            { prop: 'strokeSize', value: '2' },
            { prop: 'width', value: '24' },
        ],
        xxs: [
            { prop: 'contentStyle', value: 'body.xxs.normal' },
            { prop: 'size', value: '16' },
            { prop: 'strokeWidth', value: '2' },
            { prop: 'height', value: '16' },
            { prop: 'strokeSize', value: '2' },
            { prop: 'width', value: '16' },
        ],
    },
};
