import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'xxl', description: 'xxl' },
            { name: 'l', description: 'l' },
            { name: 'm', description: 'm' },
            { name: 's', description: 's' },
            { name: 'fit', description: 'fit' },
        ],
    },
    {
        name: 'focused',
        description: 'focused',
        styles: [
            { name: 'true', description: 'true' },
        ],
    },
    {
        name: 'shape',
        description: 'Форма',
        styles: [
            { name: 'circled', description: 'circled' },
            { name: 'rounded', description: 'rounded' },
        ],
    },
    {
        name: 'badgeView',
        description: 'badgeView',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'accent', description: 'accent' },
            { name: 'positive', description: 'positive' },
            { name: 'warning', description: 'warning' },
            { name: 'negative', description: 'negative' },
            { name: 'dark', description: 'dark' },
            { name: 'light', description: 'light' },
        ],
    },
    {
        name: 'counterView',
        description: 'counterView',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'accent', description: 'accent' },
            { name: 'positive', description: 'positive' },
            { name: 'warning', description: 'warning' },
            { name: 'negative', description: 'negative' },
            { name: 'dark', description: 'dark' },
            { name: 'light', description: 'light' },
        ],
    },
];
