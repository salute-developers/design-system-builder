import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'positive', description: 'positive' },
            { name: 'warning', description: 'warning' },
            { name: 'negative', description: 'negative' },
            { name: 'info', description: 'info' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'l', description: 'l' },
            { name: 'm', description: 'm' },
            { name: 's', description: 's' },
            { name: 'xs', description: 'xs' },
        ],
    },
    {
        name: 'orientation',
        description: 'Ориентация',
        styles: [
            { name: 'vertical', description: 'vertical' },
            { name: 'horizontal', description: 'horizontal' },
        ],
    },
];
