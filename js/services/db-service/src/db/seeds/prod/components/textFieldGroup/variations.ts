import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
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
        name: 'orientation',
        description: 'Ориентация',
        styles: [
            { name: 'horizontal', description: 'horizontal' },
            { name: 'vertical', description: 'vertical' },
        ],
    },
    {
        name: 'gap',
        description: 'gap',
        styles: [
            { name: 'none', description: 'none' },
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
    {
        name: 'stretching',
        description: 'Растяжение',
        styles: [
            { name: 'auto', description: 'auto' },
            { name: 'filled', description: 'filled' },
        ],
    },
];
