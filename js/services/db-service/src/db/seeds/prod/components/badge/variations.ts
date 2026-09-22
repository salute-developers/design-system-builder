import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'Accent' },
            { name: 'negative' },
            { name: 'positive' },
            { name: 'Default' },
            { name: 'warning' },
        ],
    },
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'L' },
            { name: 'XS' },
            { name: 'S' },
            { name: 'M' },
        ],
    },
    {
        name: 'shape',
        description: 'Форма.',
        styles: [
            { name: 'Pilled' },
            { name: 'Rounded' },
        ],
    },
];
