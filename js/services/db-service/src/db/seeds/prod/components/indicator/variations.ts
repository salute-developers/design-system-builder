import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 's' },
            { name: 'm' },
            { name: 'L' },
        ],
    },
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'Default' },
            { name: 'accent' },
            { name: 'inactive' },
            { name: 'positive' },
            { name: 'warning' },
            { name: 'negative' },
        ],
    },
];
