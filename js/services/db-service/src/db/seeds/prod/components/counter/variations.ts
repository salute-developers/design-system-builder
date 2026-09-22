import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'l' },
            { name: 'm' },
            { name: 's' },
            { name: 'xs' },
            { name: 'xxs' },
        ],
    },
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'accent' },
            { name: 'positive' },
            { name: 'default' },
            { name: 'warning' },
            { name: 'negative' },
        ],
    },
];
