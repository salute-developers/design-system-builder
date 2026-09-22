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
            { name: 'm', description: 'm' },
        ],
    },
    {
        name: 'borderRadius',
        description: 'borderRadius',
        styles: [
            { name: 'none', description: 'none' },
            { name: 'default', description: 'default' },
        ],
    },
];
