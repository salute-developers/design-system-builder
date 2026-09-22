import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'secondary' },
            { name: 'positive' },
            { name: 'warning' },
            { name: 'negative' },
            { name: 'info' },
            { name: 'default' },
            { name: 'accent' },
        ],
    },
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'l' },
            { name: 'm' },
            { name: 's' },
        ],
    },
];
