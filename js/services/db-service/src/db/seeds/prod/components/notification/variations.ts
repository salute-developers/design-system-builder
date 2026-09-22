import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'negative', description: 'negative' },
            { name: 'positive', description: 'positive' },
            { name: 'warning', description: 'warning' },
            { name: 'info', description: 'info' },
        ],
    },
    {
        name: 'layout',
        description: 'layout',
        styles: [
            { name: 'horizontal', description: 'horizontal' },
            { name: 'vertical', description: 'vertical' },
        ],
    },
    {
        name: 'closeIconType',
        description: 'closeIconType',
        styles: [
            { name: 'default', description: 'default' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'xs', description: 'xs' },
            { name: 'xxs', description: 'xxs' },
        ],
    },
];
