import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 's' },
            { name: 'l' },
            { name: 'm' },
        ],
    },
    {
        name: 'toggleSize',
        description: 'Размер переключателя.',
        styles: [
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
