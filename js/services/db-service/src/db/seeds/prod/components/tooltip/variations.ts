import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 's', description: 's' },
            { name: 'm', description: 'm' },
        ],
    },
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
        ],
    },
];
