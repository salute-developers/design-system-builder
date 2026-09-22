import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'clear', description: 'clear' },
            { name: 'secondary', description: 'secondary' },
            { name: 'divider', description: 'divider' },
            { name: 'default', description: 'default' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'xs', description: 'xs' },
            { name: 's', description: 's' },
            { name: 'm', description: 'm' },
            { name: 'l', description: 'l' },
            { name: 'h6', description: 'h6' },
            { name: 'h5', description: 'h5' },
            { name: 'h4', description: 'h4' },
            { name: 'h3', description: 'h3' },
            { name: 'h2', description: 'h2' },
            { name: 'h1', description: 'h1' },
        ],
    },
    {
        name: 'pilled',
        description: 'pilled',
        styles: [
            { name: 'true', description: 'true' },
        ],
    },
    {
        name: 'truncate',
        description: 'truncate',
        styles: [
            { name: 'true', description: 'true' },
        ],
    },
];
