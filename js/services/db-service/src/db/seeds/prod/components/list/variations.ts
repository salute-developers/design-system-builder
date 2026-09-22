import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'xs' },
            { name: 'xl' },
            { name: 'm' },
            { name: 'l' },
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
