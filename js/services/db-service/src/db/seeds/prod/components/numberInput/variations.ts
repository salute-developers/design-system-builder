import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'secondary', description: 'secondary' },
            { name: 'accent', description: 'accent' },
            { name: 'clear', description: 'clear' },
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
        name: 'shape',
        description: 'Форма',
        styles: [
            { name: 'cornered', description: 'cornered' },
            { name: 'pilled', description: 'pilled' },
        ],
    },
    {
        name: 'inputBackgroundType',
        description: 'inputBackgroundType',
        styles: [
            { name: 'fill', description: 'fill' },
            { name: 'clear', description: 'clear' },
        ],
    },
    {
        name: 'segmentation',
        description: 'segmentation',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'segmented', description: 'segmented' },
            { name: 'solid', description: 'solid' },
        ],
    },
];
