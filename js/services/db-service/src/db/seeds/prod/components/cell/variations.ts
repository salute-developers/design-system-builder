import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'l' },
            { name: 'xs' },
            { name: 'm' },
            { name: 's' },
        ],
    },
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'default' },
        ],
    },
];
