import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'secondary', description: 'secondary' },
            { name: 'clear', description: 'clear' },
        ],
    },
    {
        name: 'viewCurrentPage',
        description: 'viewCurrentPage',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'secondary', description: 'secondary' },
            { name: 'clear', description: 'clear' },
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
        name: 'type',
        description: 'type',
        styles: [
            { name: 'compact', description: 'compact' },
            { name: 'default', description: 'default' },
        ],
    },
];
