import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'M' },
            { name: 'S' },
            { name: 'l' },
        ],
    },
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'paragraph' },
            { name: 'accent' },
            { name: 'positive' },
            { name: 'warning' },
            { name: 'negative' },
            { name: 'default' },
            { name: 'secondary' },
            { name: 'tertiary' },
        ],
    },
];
