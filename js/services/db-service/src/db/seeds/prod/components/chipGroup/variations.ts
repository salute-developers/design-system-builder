import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'secondary', description: 'secondary' },
            { name: 'accent', description: 'accent' },
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
        name: 'gap',
        description: 'gap',
        styles: [
            { name: 'dense', description: 'dense' },
            { name: 'wide', description: 'wide' },
        ],
    },
    {
        name: 'shape',
        description: 'Форма',
        styles: [
            { name: 'segmented', description: 'segmented' },
            { name: 'default', description: 'default' },
        ],
    },
];
