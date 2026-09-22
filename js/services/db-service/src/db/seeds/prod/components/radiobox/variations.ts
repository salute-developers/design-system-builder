import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'View variation',
        styles: [
            { name: 'accent', description: 'Accent view' },
            { name: 'negative', description: 'Negative view' },
        ],
    },
    {
        name: 'size',
        description: 'Size variation',
        styles: [
            { name: 's', description: 'Small size' },
            { name: 'm', description: 'Medium size' },
            { name: 'l', description: 'Large size' },
        ],
    },
];
