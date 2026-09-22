import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'default' },
            { name: 'inverse' },
            { name: 'dark' },
            { name: 'light' },
        ],
    },
    {
        name: 'orientation',
        description: 'Ориентация.',
        styles: [
            { name: 'horizontal' },
            { name: 'vertical' },
        ],
    },
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'm' },
        ],
    },
];
