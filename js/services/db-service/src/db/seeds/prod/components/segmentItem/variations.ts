import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'clear', description: 'clear' },
            { name: 'secondary', description: 'secondary' },
            { name: 'default', description: 'default' },
            { name: 'accent', description: 'accent' },
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
            { name: 'xl', description: 'xl' },
        ],
    },
    {
        name: 'pilled',
        description: 'pilled',
        styles: [
            { name: 'true', description: 'true' },
        ],
    },
];
