import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид.',
        styles: [
            { name: 'accent' },
            { name: 'positive' },
            { name: 'negative' },
            { name: 'secondary' },
            { name: 'warning' },
            { name: 'info' },
            { name: 'default' },
        ],
    },
    {
        name: 'size',
        description: 'Размер.',
        styles: [
            { name: 'm' },
            { name: 'xxs' },
            { name: 'xl' },
            { name: 'l' },
            { name: 'xs' },
            { name: 's' },
        ],
    },
];
