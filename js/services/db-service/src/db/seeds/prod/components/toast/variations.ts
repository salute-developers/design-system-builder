import type { VariationSeed } from '../../component-seed';

export const variations: VariationSeed[] = [
    {
        name: 'view',
        description: 'Вид',
        styles: [
            { name: 'default', description: 'default' },
            { name: 'positive', description: 'positive' },
            { name: 'negative', description: 'negative' },
        ],
    },
    {
        name: 'size',
        description: 'Размер',
        styles: [
            { name: 'm', description: 'm' },
        ],
    },
    {
        name: 'closeIconType',
        description: 'closeIconType',
        styles: [
            { name: 'default', description: 'default' },
        ],
    },
    {
        name: 'shape',
        description: 'Форма',
        styles: [
            { name: 'rounded', description: 'Прямоугольная форма' },
            { name: 'pilled', description: 'Скруглённая форма' },
        ],
    },
];
