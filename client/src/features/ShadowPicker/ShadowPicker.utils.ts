import { general } from '@salutejs/plasma-colors';

import { prettifyColorName } from '../../utils';

export const accentColors = Object.entries(general).map(([name]) => ({
    label: prettifyColorName(name),
    value: name,
}));

export const saturationColors = Object.keys(general.amber).map((name) => ({
    label: name,
    value: name,
}));

export const paletteList = [
    {
        label: 'Корпоративная',
        value: 'corp',
    },
    {
        label: 'Кастомная',
        value: 'custom',
    },
];

export const colorFormatList = [
    {
        label: 'HEX',
        value: 'hex',
    },
    {
        label: 'RGB',
        value: 'rgb',
        disabled: true,
    },
    {
        label: 'HSL',
        value: 'hsl',
        disabled: true,
    },
];

export const DEFAULT_CORP_COLOR = 'general.red.50';

export const DEFAULT_CUSTOM_COLOR = '#000000';
