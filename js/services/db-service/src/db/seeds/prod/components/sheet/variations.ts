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
        name: 'handlePlacement',
        description: 'handlePlacement',
        styles: [
            { name: 'inner', description: 'inner' },
            { name: 'outer', description: 'outer' },
        ],
    },
];
