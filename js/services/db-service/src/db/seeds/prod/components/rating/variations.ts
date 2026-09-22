import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
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
            { name: 'xxs', description: 'xxs' },
            { name: 'h1', description: 'h1' },
            { name: 'h2', description: 'h2' },
            { name: 'h3', description: 'h3' },
            { name: 'h4', description: 'h4' },
            { name: 'h5', description: 'h5' },
            { name: 'h6', description: 'h6' },
            { name: 'displayL', description: 'displayL' },
            { name: 'displayM', description: 'displayM' },
            { name: 'displayS', description: 'displayS' },
        ],
    },
];
