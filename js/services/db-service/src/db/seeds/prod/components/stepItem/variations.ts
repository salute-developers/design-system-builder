import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'accent', description: 'accent' },
            { name: 'negative', description: 'negative' },
            { name: 'warning', description: 'warning' },
            { name: 'positive', description: 'positive' },
        ],
    },
];
