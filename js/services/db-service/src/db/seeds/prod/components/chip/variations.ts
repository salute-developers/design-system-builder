import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'l' },
            { name: 's' },
            { name: 'xxs' },
            { name: 'm' },
            { name: 'xs' },
        ],
    },
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'positive' },
            { name: 'accent' },
            { name: 'default' },
            { name: 'warning' },
            { name: 'negative' },
            { name: 'secondary' },
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
