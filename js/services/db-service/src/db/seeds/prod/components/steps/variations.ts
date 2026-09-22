import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'accent', description: 'accent' },
        ],
    },
    {
        name: 'itemView',
        description: 'itemView',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'negative', description: 'negative' },
            { name: 'warning', description: 'warning' },
            { name: 'positive', description: 'positive' },
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
];
