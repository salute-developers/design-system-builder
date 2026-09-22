import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'View variation',
        styles: [
            { name: 'default', description: 'Default view' },
            { name: 'secondary', description: 'Secondary view' },
            { name: 'accent', description: 'Accent view' },
        ],
    },
    {
        name: 'size',
        description: 'Size variation',
        styles: [
            { name: 'xl', description: 'Extra large size' },
            { name: 'l', description: 'Large size' },
            { name: 'm', description: 'Medium size' },
            { name: 's', description: 'Small size' },
            { name: 'xs', description: 'Extra small size' },
        ],
    },
    {
        name: 'shape',
        description: 'Shape variation',
        styles: [
            { name: 'rounded', description: 'Rounded shape' },
            { name: 'pilled', description: 'Pilled shape' },
        ],
    },
];
