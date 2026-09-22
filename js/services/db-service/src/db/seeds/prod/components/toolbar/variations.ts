import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'xs', description: 'xs' },
            { name: 's', description: 's' },
            { name: 'm', description: 'm' },
            { name: 'l', description: 'l' },
        ],
    },
];
