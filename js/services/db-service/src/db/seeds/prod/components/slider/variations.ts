import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'm' },
            { name: 's' },
            { name: 'l' },
        ],
    },
    {
        name: 'pointerSize',
        description: 'Размер кружка.',
        styles: [
            { name: 'large' },
            { name: 'none' },
            { name: 'small' },
        ],
    },
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'accent' },
            { name: 'default' },
        ],
    },
];
