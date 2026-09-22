import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'View variation',
        styles: [
            { name: 'default', description: 'Default view' },
            { name: 'secondary', description: 'Secondary view' },
            { name: 'accent', description: 'Accent view' },
            { name: 'clear', description: 'Clear view' },
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
